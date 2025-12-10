# Telegram Notification Bot

A Telegram bot for notifying employees to send work reports to the company group. The bot uses the Iranian (Jalaali) calendar and supports employee management, leave tracking, and message viewing confirmation.

## Features

- 📅 **Solar Date Support**: Uses Jalaali (Iranian) calendar for all date operations
- 👥 **Employee Management**: Add, remove, and list employees
- 📨 **Daily Messages**: Sends automated daily messages at a specified time
- ✅ **View Tracking**: Tracks who has viewed the daily message with timestamps
- 🏖️ **Leave Management**: Manage employee leaves and exclude them from notifications
- 🔐 **Multi-Admin Support**: Multiple admins can manage the bot
- 🔄 **Resend Messages**: Admins can resend messages to specific employees via buttons
- 🔐 **Admin Controls**: Secure admin-only commands for bot management

## Installation

1. Clone this repository:

```bash
cd d:\GitHub\notification-bot
```

2. Install dependencies:

```bash
npm install
```

3. Configure the bot:
   - Copy `.env.example` to `.env`
   - Add your Telegram bot token to `.env`
   - Optionally set your Telegram user ID as the initial admin

```env
TELEGRAM_BOT_TOKEN=your_bot_token_here
INITIAL_ADMIN_ID=your_telegram_id_here
```

4. Start the bot:

```bash
npm start
```

## Bot Commands

### Admin Management

- `/addadmin <id>` - Add a new admin to the bot
  - Example: `/addadmin 123456789`
- `/removeadmin <id>` - Remove an admin from the bot
  - Example: `/removeadmin 123456789`
- `/listadmins` - List all admins

### Employee Management

- `/addemployee <name> <id>` - Add a new employee
  - Example: `/addemployee Sadra 123456789`
- `/removeemployee <id>` - Remove an employee
  - Example: `/removeemployee 123456789`
- `/listemployees` - List all employees (text format)
- `/employees` - Show employees as buttons (click to resend message)

### Message Configuration

- `/setmessage <text>` - Set the daily message text
  - Example: `/setmessage Please check today's work report.`
- `/settime <HH:MM>` - Set the time for daily messages
  - Example: `/settime 17:00`

### Leave Management

- `/off <id> <startDate> <endDate>` - Add employee leave
  - Example: `/off 123456789 1404/08/01 1404/08/05`
  - Date format: YYYY/MM/DD (Jalaali)
- `/removeoff <id>` - Remove all leaves for an employee
  - Example: `/removeoff 123456789`
- `/offlist` - List all employee leaves

### Reporting

- `/seenlist` - View who has seen today's message
  - Shows employees who viewed the message with timestamps
  - Shows employees who haven't viewed the message
  - Excludes employees on leave

### Resending Messages

Use the `/employees` command to see a list of all employees as buttons. Click on any employee's name to resend the daily message to them. This is useful if:

- An employee didn't receive the original message
- An employee needs a reminder
- You want to manually send the message to someone

Employees on leave will be marked with a 🏖️ icon.

### For Employees

When employees receive the daily message, they can click the **"✅ دیدم"** (I saw) button to confirm they've viewed it. The button records:

- The time they viewed the message
- Their name in the seen list for the admin to review

## Data Structure

All data is stored in JSON files in the `data/` directory:

- `admin.json` - List of admin user IDs (supports multiple admins)
- `employees.json` - List of employees with names and IDs
- `message.json` - Daily message text
- `time.json` - Time for sending daily messages
- `off.json` - Employee leave records
- `seen.json` - Message view tracking by date

## How It Works

1. **Daily Messages**: At the configured time, the bot sends a message to all employees (except those on leave) with a confirmation button
2. **View Tracking**: When an employee clicks "I saw", the timestamp is recorded
3. **Admin Monitoring**: Admins can check who has viewed the message using `/seenlist`
4. **Leave Management**: Employees on leave are automatically excluded from receiving messages

## Getting Your Telegram User ID

To find your Telegram user ID:

1. Start a chat with [@userinfobot](https://t.me/userinfobot)
2. Send any message
3. The bot will reply with your user ID

## Security Notes

- Keep your bot token secure and never commit it to version control
- Only the admin can execute management commands
- The `.gitignore` file prevents sensitive data from being committed

## Troubleshooting

- **Bot not responding**: Check that the bot token is correct in `.env`
- **Messages not sending**: Verify the time is set correctly with `/settime`
- **Permission errors**: Ensure you're using an admin account for management commands
- **Employee not receiving messages**: Check if they're on leave with `/offlist`

## Technologies Used

- [node-telegram-bot-api](https://github.com/yagop/node-telegram-bot-api) - Telegram Bot API wrapper
- [jalaali-js](https://github.com/jalaali/jalaali-js) - Jalaali (Iranian) calendar conversion
- [node-cron](https://github.com/node-cron/node-cron) - Task scheduling
- [dotenv](https://github.com/motdotla/dotenv) - Environment variable management

## License

ISC

## Support

For issues or questions, please create an issue in the repository.
