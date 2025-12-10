require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const jalaali = require("jalaali-js");
const cron = require("node-cron");
const fs = require("fs");
const path = require("path");

// Initialize bot
const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// Data directory
const dataDir = path.join(__dirname, "data");

// Helper functions for database operations
function readJSON(filename) {
  const filePath = path.join(dataDir, filename);
  try {
    const data = fs.readFileSync(filePath, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading ${filename}:`, error);
    return null;
  }
}

function writeJSON(filename, data) {
  const filePath = path.join(dataDir, filename);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
    return true;
  } catch (error) {
    console.error(`Error writing ${filename}:`, error);
    return false;
  }
}

// Jalaali date utilities
function getCurrentJalaaliDate() {
  const now = new Date();
  const jDate = jalaali.toJalaali(now);
  return `${jDate.jy}/${String(jDate.jm).padStart(2, "0")}/${String(
    jDate.jd
  ).padStart(2, "0")}`;
}

function getCurrentTime() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(
    now.getMinutes()
  ).padStart(2, "0")}`;
}

function parseJalaaliDate(dateStr) {
  // Expected format: 1404/08/01
  const parts = dateStr.split("/");
  if (parts.length !== 3) return null;
  return {
    jy: parseInt(parts[0]),
    jm: parseInt(parts[1]),
    jd: parseInt(parts[2]),
  };
}

function isDateInRange(dateStr, startStr, endStr) {
  const date = parseJalaaliDate(dateStr);
  const start = parseJalaaliDate(startStr);
  const end = parseJalaaliDate(endStr);

  if (!date || !start || !end) return false;

  const dateGregorian = jalaali.toGregorian(date.jy, date.jm, date.jd);
  const startGregorian = jalaali.toGregorian(start.jy, start.jm, start.jd);
  const endGregorian = jalaali.toGregorian(end.jy, end.jm, end.jd);

  const dateTime = new Date(
    dateGregorian.gy,
    dateGregorian.gm - 1,
    dateGregorian.gd
  ).getTime();
  const startTime = new Date(
    startGregorian.gy,
    startGregorian.gm - 1,
    startGregorian.gd
  ).getTime();
  const endTime = new Date(
    endGregorian.gy,
    endGregorian.gm - 1,
    endGregorian.gd
  ).getTime();

  return dateTime >= startTime && dateTime <= endTime;
}

// Check if user is admin
function isAdmin(userId) {
  const adminData = readJSON("admin.json");
  if (!adminData || !Array.isArray(adminData.adminIds)) return false;
  return adminData.adminIds.includes(userId);
}

// Get all admins
function getAdmins() {
  const adminData = readJSON("admin.json");
  return adminData && Array.isArray(adminData.adminIds)
    ? adminData.adminIds
    : [];
}

// Helper function to get employee ID (handles both 'id' and 'userId' fields)
function getEmployeeId(employee) {
  return employee.id || parseInt(employee.userId) || null;
}

// Helper function to normalize employee object
function normalizeEmployee(employee) {
  const id = getEmployeeId(employee);
  return {
    id: id,
    name: employee.name,
    userId: employee.userId || id?.toString(),
    addedAt: employee.addedAt || new Date().toISOString(),
  };
}

// Check if employee is on leave
function isEmployeeOnLeave(employeeId) {
  const offData = readJSON("off.json");
  const currentDate = getCurrentJalaaliDate();

  if (!offData || !Array.isArray(offData)) return false;

  return offData.some((leave) => {
    return (
      leave.id === employeeId &&
      isDateInRange(currentDate, leave.from, leave.to)
    );
  });
}

// Admin middleware
function adminOnly(callback) {
  return (msg, match) => {
    if (isAdmin(msg.from.id)) {
      callback(msg, match);
    } else {
      bot.sendMessage(
        msg.chat.id,
        "❌ فقط ادمین می‌تواند از این دستور استفاده کند."
      );
    }
  };
}

// ============= COMMANDS =============

// /start and /help commands
bot.onText(/\/(start|help)/, (msg) => {
  const chatId = msg.chat.id;
  const isUserAdmin = isAdmin(msg.from.id);

  let helpMessage = "🤖 *Telegram Notification Bot*\n\n";

  if (isUserAdmin) {
    helpMessage += "👑 *شما ادمین هستید*\n\n";
    helpMessage += "برای استفاده از دستورات، روی دکمه‌های زیر کلیک کنید:\n";
    helpMessage +=
      "دستور نمونه در کادر پیام ظاهر می‌شود و می‌توانید آن را ویرایش کنید.";

    const keyboard = {
      inline_keyboard: [
        [
          { text: "👥 افزودن کارمند", callback_data: "cmd_addemployee" },
          { text: "❌ حذف کارمند", callback_data: "cmd_removeemployee" },
        ],
        [
          { text: "📋 لیست کارمندان", callback_data: "cmd_listemployees" },
          { text: "🔄 لیست با دکمه", callback_data: "cmd_employees" },
        ],
        [
          { text: "👑 افزودن ادمین", callback_data: "cmd_addadmin" },
          { text: "📋 لیست ادمین‌ها", callback_data: "cmd_listadmins" },
        ],
        [
          { text: "💬 تنظیم پیام", callback_data: "cmd_setmessage" },
          { text: "⏰ تنظیم زمان", callback_data: "cmd_settime" },
        ],
        [
          { text: "🏖️ ثبت مرخصی", callback_data: "cmd_off" },
          { text: "📋 لیست مرخصی", callback_data: "cmd_offlist" },
        ],
        [
          { text: "📊 گزارش بازدید", callback_data: "cmd_seenlist" },
          { text: "🆔 دریافت ID", url: "https://t.me/userinfobot" },
        ],
      ],
    };

    bot.sendMessage(chatId, helpMessage, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  } else {
    helpMessage += "👤 *شما کارمند هستید.*\n\n";
    helpMessage += "شما روزانه در ساعت مشخص پیامی دریافت خواهید کرد.\n";
    helpMessage +=
      'لطفاً با کلیک بر روی دکمه "✅ دیدم" تایید کنید که پیام را دیده‌اید.\n\n';
    helpMessage += "برای سوالات بیشتر با ادمین تماس بگیرید.";

    bot.sendMessage(chatId, helpMessage, { parse_mode: "Markdown" });
  }
});

// /addadmin command
bot.onText(
  /\/addadmin(.*)/,
  adminOnly((msg, match) => {
    const chatId = msg.chat.id;

    if (!match || !match[1]) {
      bot.sendMessage(
        chatId,
        "❌ لطفاً ID کاربر را وارد کنید.\nمثال: /addadmin 123456789"
      );
      return;
    }

    const params = match[1].trim();
    const newAdminId = params ? parseInt(params) : null;

    if (!newAdminId || isNaN(newAdminId)) {
      bot.sendMessage(
        chatId,
        "❌ لطفاً ID کاربر را وارد کنید.\nمثال: /addadmin 123456789"
      );
      return;
    }

    const adminData = readJSON("admin.json") || { adminIds: [] };
    if (!Array.isArray(adminData.adminIds)) {
      adminData.adminIds = [];
    }

    if (adminData.adminIds.includes(newAdminId)) {
      bot.sendMessage(chatId, "❌ این کاربر قبلاً ادمین است.");
      return;
    }

    adminData.adminIds.push(newAdminId);

    if (writeJSON("admin.json", adminData)) {
      bot.sendMessage(chatId, `✅ ادمین جدید با ID ${newAdminId} اضافه شد.`);
    } else {
      bot.sendMessage(chatId, "❌ خطا در افزودن ادمین.");
    }
  })
);

// /removeadmin command
bot.onText(
  /\/removeadmin(.*)/,
  adminOnly((msg, match) => {
    const chatId = msg.chat.id;

    if (!match || !match[1]) {
      bot.sendMessage(
        chatId,
        "❌ لطفاً ID ادمین را وارد کنید.\nمثال: /removeadmin 123456789"
      );
      return;
    }

    const params = match[1].trim();
    const adminId = params ? parseInt(params) : null;

    if (!adminId || isNaN(adminId)) {
      bot.sendMessage(
        chatId,
        "❌ لطفاً ID ادمین را وارد کنید.\nمثال: /removeadmin 123456789"
      );
      return;
    }

    const adminData = readJSON("admin.json") || { adminIds: [] };
    if (!Array.isArray(adminData.adminIds)) {
      adminData.adminIds = [];
    }

    if (adminData.adminIds.length === 1) {
      bot.sendMessage(chatId, "❌ نمی‌توانید آخرین ادمین را حذف کنید.");
      return;
    }

    const initialLength = adminData.adminIds.length;
    adminData.adminIds = adminData.adminIds.filter((id) => id !== adminId);

    if (adminData.adminIds.length === initialLength) {
      bot.sendMessage(chatId, "❌ این کاربر ادمین نیست.");
      return;
    }

    if (writeJSON("admin.json", adminData)) {
      bot.sendMessage(chatId, `✅ ادمین با ID ${adminId} حذف شد.`);
    } else {
      bot.sendMessage(chatId, "❌ خطا در حذف ادمین.");
    }
  })
);

// /listadmins command
bot.onText(
  /\/listadmins/,
  adminOnly((msg) => {
    const chatId = msg.chat.id;
    const admins = getAdmins();

    if (admins.length === 0) {
      bot.sendMessage(chatId, "📋 هیچ ادمینی ثبت نشده است.");
      return;
    }

    let message = "📋 لیست ادمین‌ها:\n\n";
    admins.forEach((adminId, index) => {
      message += `${index + 1}. ID: ${adminId}\n`;
    });

    bot.sendMessage(chatId, message);
  })
);

// /addemployee command
bot.onText(
  /\/addemployee(.*)/,
  adminOnly((msg, match) => {
    const chatId = msg.chat.id;

    // Safety check for match array
    if (!match || !match[1]) {
      bot.sendMessage(
        chatId,
        "❌ لطفاً نام و ID را وارد کنید.\nمثال: /addemployee صدرا 123456789"
      );
      return;
    }

    const params = match[1].trim();

    if (!params) {
      bot.sendMessage(
        chatId,
        "❌ لطفاً نام و ID را وارد کنید.\nمثال: /addemployee صدرا 123456789"
      );
      return;
    }

    // Split by spaces and get last element as ID, rest as name
    const parts = params.split(/\s+/);
    if (parts.length < 2) {
      bot.sendMessage(
        chatId,
        "❌ لطفاً نام و ID را وارد کنید.\nمثال: /addemployee صدرا 123456789"
      );
      return;
    }

    const id = parseInt(parts[parts.length - 1]);
    const name = parts.slice(0, -1).join(" ");

    if (!name || isNaN(id)) {
      bot.sendMessage(
        chatId,
        "❌ فرمت ورودی نامعتبر است.\nمثال: /addemployee صدرا 123456789"
      );
      return;
    }

    const employees = readJSON("employees.json") || [];

    // Check if employee already exists
    if (employees.some((emp) => getEmployeeId(emp) === id)) {
      bot.sendMessage(chatId, "❌ این کارمند قبلاً اضافه شده است.");
      return;
    }

    employees.push({
      id: id,
      name: name,
      userId: id.toString(),
      addedAt: new Date().toISOString(),
    });

    if (writeJSON("employees.json", employees)) {
      bot.sendMessage(chatId, `✅ کارمند ${name} با ID ${id} اضافه شد.`);
    } else {
      bot.sendMessage(chatId, "❌ خطا در افزودن کارمند.");
    }
  })
);

// /removeemployee command
bot.onText(
  /\/removeemployee(.*)/,
  adminOnly((msg, match) => {
    const chatId = msg.chat.id;

    if (!match || !match[1]) {
      bot.sendMessage(
        chatId,
        "❌ لطفاً ID کارمند را وارد کنید.\nمثال: /removeemployee 123456789"
      );
      return;
    }

    const params = match[1].trim();
    const id = params ? parseInt(params) : null;

    if (!id || isNaN(id)) {
      bot.sendMessage(
        chatId,
        "❌ لطفاً ID کارمند را وارد کنید.\nمثال: /removeemployee 123456789"
      );
      return;
    }

    let employees = readJSON("employees.json") || [];
    const initialLength = employees.length;
    employees = employees.filter((emp) => getEmployeeId(emp) !== id);

    if (employees.length === initialLength) {
      bot.sendMessage(chatId, "❌ کارمندی با این ID یافت نشد.");
      return;
    }

    if (writeJSON("employees.json", employees)) {
      bot.sendMessage(chatId, `✅ کارمند با ID ${id} حذف شد.`);
    } else {
      bot.sendMessage(chatId, "❌ خطا در حذف کارمند.");
    }
  })
);

// /listemployees command
bot.onText(
  /\/listemployees/,
  adminOnly((msg) => {
    const chatId = msg.chat.id;
    const employees = readJSON("employees.json") || [];

    if (employees.length === 0) {
      bot.sendMessage(chatId, "📋 هیچ کارمندی ثبت نشده است.");
      return;
    }

    let message = "📋 لیست کارمندان:\n\n";
    employees.forEach((emp, index) => {
      const empId = getEmployeeId(emp);
      message += `${index + 1}. ${emp.name} (ID: ${empId})\n`;
    });

    bot.sendMessage(chatId, message);
  })
);

// /employees command with buttons
bot.onText(
  /\/employees/,
  adminOnly((msg) => {
    const chatId = msg.chat.id;
    const employees = readJSON("employees.json") || [];

    if (employees.length === 0) {
      bot.sendMessage(chatId, "📋 هیچ کارمندی ثبت نشده است.");
      return;
    }

    // Create inline keyboard with employee buttons
    const keyboard = [];
    employees.forEach((emp) => {
      const empId = getEmployeeId(emp);
      const onLeave = isEmployeeOnLeave(empId);
      const buttonText = onLeave ? `${emp.name} 🏖️` : emp.name;
      keyboard.push([
        {
          text: buttonText,
          callback_data: `resend_${empId}`,
        },
      ]);
    });

    bot.sendMessage(chatId, "👥 انتخاب کنید که پیام به چه کسی ارسال شود:", {
      reply_markup: {
        inline_keyboard: keyboard,
      },
    });
  })
);

// /setmessage command
bot.onText(
  /\/setmessage(.*)/,
  adminOnly((msg, match) => {
    const chatId = msg.chat.id;

    if (!match || !match[1]) {
      bot.sendMessage(
        chatId,
        "❌ لطفاً متن پیام را وارد کنید.\nمثال: /setmessage لطفاً گزارش کار امروز را چک کنید."
      );
      return;
    }

    const newMessage = match[1].trim();

    if (!newMessage) {
      bot.sendMessage(
        chatId,
        "❌ لطفاً متن پیام را وارد کنید.\nمثال: /setmessage لطفاً گزارش کار امروز را چک کنید."
      );
      return;
    }

    const messageData = { text: newMessage };

    if (writeJSON("message.json", messageData)) {
      bot.sendMessage(chatId, `✅ متن پیام روزانه تنظیم شد:\n\n${newMessage}`);
    } else {
      bot.sendMessage(chatId, "❌ خطا در تنظیم پیام.");
    }
  })
);

// /settime command
bot.onText(
  /\/settime(.*)/,
  adminOnly((msg, match) => {
    const chatId = msg.chat.id;

    if (!match || !match[1]) {
      bot.sendMessage(
        chatId,
        "❌ لطفاً زمان را به فرمت صحیح وارد کنید.\nمثال: /settime 17:00"
      );
      return;
    }

    const timeInput = match[1].trim();

    if (!timeInput) {
      bot.sendMessage(
        chatId,
        "❌ لطفاً زمان را به فرمت صحیح وارد کنید.\nمثال: /settime 17:00"
      );
      return;
    }

    const timeMatch = timeInput.match(/^(\d{1,2}):(\d{2})$/);
    if (!timeMatch) {
      bot.sendMessage(
        chatId,
        "❌ لطفاً زمان را به فرمت صحیح وارد کنید.\nمثال: /settime 17:00"
      );
      return;
    }

    const hours = timeMatch[1];
    const minutes = timeMatch[2];

    const h = parseInt(hours);
    const m = parseInt(minutes);

    if (h < 0 || h > 23 || m < 0 || m > 59) {
      bot.sendMessage(chatId, "❌ زمان وارد شده نامعتبر است.");
      return;
    }

    const timeStr = `${String(h).padStart(2, "0")}:${String(m).padStart(
      2,
      "0"
    )}`;
    const timeData = { time: timeStr };

    if (writeJSON("time.json", timeData)) {
      bot.sendMessage(
        chatId,
        `✅ زمان ارسال پیام روزانه به ${timeStr} تنظیم شد.`
      );
      setupCronJob(); // Restart cron job with new time
    } else {
      bot.sendMessage(chatId, "❌ خطا در تنظیم زمان.");
    }
  })
);

// /off command
bot.onText(
  /\/off(.*)/,
  adminOnly((msg, match) => {
    const chatId = msg.chat.id;

    if (!match || !match[1]) {
      bot.sendMessage(
        chatId,
        "❌ لطفاً اطلاعات را به فرمت صحیح وارد کنید.\nمثال: /off 123456789 1404/08/01 1404/08/05"
      );
      return;
    }

    const params = match[1].trim();

    if (!params) {
      bot.sendMessage(
        chatId,
        "❌ لطفاً اطلاعات را به فرمت صحیح وارد کنید.\nمثال: /off 123456789 1404/08/01 1404/08/05"
      );
      return;
    }

    const parts = params.split(/\s+/);
    if (parts.length !== 3) {
      bot.sendMessage(
        chatId,
        "❌ لطفاً اطلاعات را به فرمت صحیح وارد کنید.\nمثال: /off 123456789 1404/08/01 1404/08/05"
      );
      return;
    }

    const id = parseInt(parts[0]);
    const startDate = parts[1];
    const endDate = parts[2];

    if (isNaN(id)) {
      bot.sendMessage(chatId, "❌ ID وارد شده نامعتبر است.");
      return;
    }

    // Validate dates
    if (!parseJalaaliDate(startDate) || !parseJalaaliDate(endDate)) {
      bot.sendMessage(
        chatId,
        "❌ فرمت تاریخ نامعتبر است. فرمت صحیح: YYYY/MM/DD"
      );
      return;
    }

    const offData = readJSON("off.json") || [];

    // Check if employee exists
    const employees = readJSON("employees.json") || [];
    const employee = employees.find((emp) => getEmployeeId(emp) === id);

    if (!employee) {
      bot.sendMessage(chatId, "❌ کارمندی با این ID یافت نشد.");
      return;
    }

    offData.push({ id, from: startDate, to: endDate });

    if (writeJSON("off.json", offData)) {
      bot.sendMessage(
        chatId,
        `✅ مرخصی ${employee.name} از ${startDate} تا ${endDate} ثبت شد.`
      );
    } else {
      bot.sendMessage(chatId, "❌ خطا در ثبت مرخصی.");
    }
  })
);

// /removeoff command
bot.onText(
  /\/removeoff(.*)/,
  adminOnly((msg, match) => {
    const chatId = msg.chat.id;

    if (!match || !match[1]) {
      bot.sendMessage(
        chatId,
        "❌ لطفاً ID کارمند را وارد کنید.\nمثال: /removeoff 123456789"
      );
      return;
    }

    const params = match[1].trim();
    const id = params ? parseInt(params) : null;

    if (!id || isNaN(id)) {
      bot.sendMessage(
        chatId,
        "❌ لطفاً ID کارمند را وارد کنید.\nمثال: /removeoff 123456789"
      );
      return;
    }

    let offData = readJSON("off.json") || [];
    const initialLength = offData.length;

    // Remove all leaves for this employee
    offData = offData.filter((leave) => leave.id !== id);

    if (offData.length === initialLength) {
      bot.sendMessage(chatId, "❌ مرخصی برای این کارمند یافت نشد.");
      return;
    }

    if (writeJSON("off.json", offData)) {
      bot.sendMessage(chatId, `✅ مرخصی کارمند با ID ${id} حذف شد.`);
    } else {
      bot.sendMessage(chatId, "❌ خطا در حذف مرخصی.");
    }
  })
);

// /offlist command
bot.onText(
  /\/offlist/,
  adminOnly((msg) => {
    const chatId = msg.chat.id;
    const offData = readJSON("off.json") || [];
    const employees = readJSON("employees.json") || [];

    if (offData.length === 0) {
      bot.sendMessage(chatId, "📋 هیچ مرخصی ثبت نشده است.");
      return;
    }

    let message = "📋 لیست مرخصی‌ها:\n\n";
    offData.forEach((leave, index) => {
      const employee = employees.find((emp) => getEmployeeId(emp) === leave.id);
      const name = employee ? employee.name : "نامشخص";
      message += `${index + 1}. ${name} (ID: ${leave.id})\n`;
      message += `   از ${leave.from} تا ${leave.to}\n\n`;
    });

    bot.sendMessage(chatId, message);
  })
);

// /seenlist command
bot.onText(
  /\/seenlist/,
  adminOnly((msg) => {
    const chatId = msg.chat.id;
    const currentDate = getCurrentJalaaliDate();
    const seenData = readJSON("seen.json") || {};
    const employees = readJSON("employees.json") || [];

    const todaySeenData = seenData[currentDate] || {};

    let seenList = [];
    let notSeenList = [];

    employees.forEach((emp) => {
      const empId = getEmployeeId(emp);
      if (todaySeenData[empId]) {
        seenList.push(`- ${emp.name} (${todaySeenData[empId]})`);
      } else if (!isEmployeeOnLeave(empId)) {
        notSeenList.push(`- ${emp.name}`);
      }
    });

    let message = `📊 گزارش مشاهده پیام امروز (${currentDate}):\n\n`;

    if (seenList.length > 0) {
      message += "✅ افرادی که پیام را دیدند:\n";
      message += seenList.join("\n") + "\n\n";
    } else {
      message += "❌ هیچ کس پیام را ندیده است.\n\n";
    }

    if (notSeenList.length > 0) {
      message += "⏳ افرادی که پیام را ندیده‌اند:\n";
      message += notSeenList.join("\n");
    } else {
      message += "✅ همه پیام را دیده‌اند!";
    }

    bot.sendMessage(chatId, message);
  })
);

// Handle "I saw" button callback
bot.on("callback_query", (query) => {
  const userId = query.from.id;
  const data = query.data;

  // Handle command template buttons from /help
  if (data.startsWith("cmd_")) {
    const commandTemplates = {
      cmd_addemployee: "/addemployee نام 123456789",
      cmd_removeemployee: "/removeemployee 123456789",
      cmd_listemployees: "/listemployees",
      cmd_employees: "/employees",
      cmd_addadmin: "/addadmin 123456789",
      cmd_listadmins: "/listadmins",
      cmd_setmessage: "/setmessage لطفاً گزارش کار امروز را چک کنید",
      cmd_settime: "/settime 17:00",
      cmd_off: "/off 123456789 1404/09/01 1404/09/10",
      cmd_offlist: "/offlist",
      cmd_seenlist: "/seenlist",
    };

    const template = commandTemplates[data];
    if (template) {
      bot.sendMessage(query.message.chat.id, template);
      bot.answerCallbackQuery(query.id, {
        text: "✅ دستور در کادر پیام ظاهر شد. می‌توانید آن را ویرایش کنید.",
        show_alert: false,
      });
    }
    return;
  }

  // Handle resend message to employee
  if (data.startsWith("resend_")) {
    const employeeId = parseInt(data.replace("resend_", ""));
    const employees = readJSON("employees.json") || [];
    const employee = employees.find((emp) => getEmployeeId(emp) === employeeId);

    if (!employee) {
      bot.answerCallbackQuery(query.id, {
        text: "❌ کارمند یافت نشد.",
        show_alert: true,
      });
      return;
    }

    const messageData = readJSON("message.json");
    if (!messageData || !messageData.text) {
      bot.answerCallbackQuery(query.id, {
        text: "❌ متن پیام تنظیم نشده است.",
        show_alert: true,
      });
      return;
    }

    // Add employee name to message
    const personalizedMessage = `سلام ${employee.name} عزیز،\n\n${messageData.text}`;

    const keyboard = {
      inline_keyboard: [[{ text: "✅ دیدم", callback_data: "seen" }]],
    };

    bot
      .sendMessage(employeeId, personalizedMessage, { reply_markup: keyboard })
      .then(() => {
        bot.answerCallbackQuery(query.id, {
          text: `✅ پیام به ${employee.name} ارسال شد.`,
          show_alert: false,
        });
      })
      .catch((error) => {
        bot.answerCallbackQuery(query.id, {
          text: `❌ خطا در ارسال پیام: ${error.message}`,
          show_alert: true,
        });
      });
    return;
  }

  if (data === "seen") {
    const currentDate = getCurrentJalaaliDate();
    const currentTime = getCurrentTime();

    const seenData = readJSON("seen.json") || {};

    if (!seenData[currentDate]) {
      seenData[currentDate] = {};
    }

    // Check if already marked as seen
    if (seenData[currentDate][userId]) {
      bot.answerCallbackQuery(query.id, {
        text: `شما قبلاً در ساعت ${seenData[currentDate][userId]} این پیام را دیدید.`,
        show_alert: true,
      });
      return;
    }

    seenData[currentDate][userId] = currentTime;

    if (writeJSON("seen.json", seenData)) {
      bot.answerCallbackQuery(query.id, {
        text: "✅ دیدن پیام ثبت شد!",
        show_alert: false,
      });

      // Edit the message to show it was seen
      bot
        .editMessageReplyMarkup(
          {
            inline_keyboard: [
              [{ text: "✅ دیده شد", callback_data: "already_seen" }],
            ],
          },
          {
            chat_id: query.message.chat.id,
            message_id: query.message.message_id,
          }
        )
        .catch(() => {});
    } else {
      bot.answerCallbackQuery(query.id, {
        text: "❌ خطا در ثبت دیدن پیام",
        show_alert: true,
      });
    }
  } else if (data === "already_seen") {
    bot.answerCallbackQuery(query.id, {
      text: "✅ شما قبلاً این پیام را دیده‌اید.",
      show_alert: false,
    });
  }
});

// ============= DAILY MESSAGE SCHEDULER =============

let cronJob = null;

function setupCronJob() {
  // Stop existing job
  if (cronJob) {
    cronJob.stop();
  }

  const timeData = readJSON("time.json");
  if (!timeData || !timeData.time) {
    console.log("No time set for daily messages");
    return;
  }

  const [hours, minutes] = timeData.time.split(":");
  const cronExpression = `${minutes} ${hours} * * *`;

  console.log(`Setting up cron job for ${timeData.time} (${cronExpression})`);

  cronJob = cron.schedule(
    cronExpression,
    () => {
      sendDailyMessages();
    },
    {
      timezone: "Asia/Tehran",
    }
  );
}

function sendDailyMessages() {
  console.log("Sending daily messages...");

  const employees = readJSON("employees.json") || [];
  const messageData = readJSON("message.json");

  if (!messageData || !messageData.text) {
    console.error("No message text set");
    return;
  }

  const messageText = messageData.text;
  const currentDate = getCurrentJalaaliDate();

  employees.forEach((emp) => {
    const empId = getEmployeeId(emp);

    // Skip employees on leave
    if (isEmployeeOnLeave(empId)) {
      console.log(`Skipping ${emp.name} (on leave)`);
      return;
    }

    // Add employee name to message
    const personalizedMessage = `سلام ${emp.name} عزیز،\n\n${messageText}`;

    const keyboard = {
      inline_keyboard: [[{ text: "✅ دیدم", callback_data: "seen" }]],
    };

    bot
      .sendMessage(empId, personalizedMessage, { reply_markup: keyboard })
      .then(() => {
        console.log(`Message sent to ${emp.name} (${empId})`);
      })
      .catch((error) => {
        console.log(
          `Failed to send message to ${emp.name} (${empId}):`,
          error.message
        );
      });
  });
}

// ============= INITIALIZATION =============

// Set initial admin if specified in .env
const initialAdminId = process.env.INITIAL_ADMIN_ID;
if (initialAdminId) {
  const adminData = readJSON("admin.json");
  if (
    !adminData ||
    !Array.isArray(adminData.adminIds) ||
    adminData.adminIds.length === 0
  ) {
    writeJSON("admin.json", { adminIds: [parseInt(initialAdminId)] });
    console.log(`Initial admin set to ${initialAdminId}`);
  }
}

// Start cron job
setupCronJob();

// Bot started message
console.log("Telegram Notification Bot is running...");
console.log("Press Ctrl+C to stop.");

bot.on("polling_error", (error) => {
  console.error("Polling error:", error.message);
  console.error("Full error:", error);
});
