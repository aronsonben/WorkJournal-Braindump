# WorkJournal Desktop Widget

A desktop widget for quick work journal entry input that stays on top of all windows.

## Features

- 🎯 **Small floating widget** (60x60px) in bottom-right corner
- 🔄 **Click to expand** to 400x200px input interface  
- 📝 **Dark theme** with textarea and status dropdown
- ⚡ **Global shortcut** Ctrl+Shift+W (Cmd+Shift+W on Mac) to toggle
- 💾 **Auto-save** to your existing Supabase database
- 🎨 **Transparent background** and frameless window
- 📱 **System tray** integration with quit option
- 🚀 **Auto-start** with system login
- ✨ **Auto-collapse** after saving entry

## Setup Instructions

### 1. Install Dependencies

```bash
cd electron-widget
npm install
```

### 2. Configure API Connection

Edit `index.html` and update the CONFIG object with your credentials:

```javascript
const CONFIG = {
    API_ENDPOINT: 'https://your-workjournal-site.vercel.app/api/entries', // Your API endpoint (optional)
    API_KEY: 'your-api-key', // Your API key (optional)
    SUPABASE_URL: 'https://your-project.supabase.co', // Your Supabase URL
    SUPABASE_ANON_KEY: 'your-supabase-anon-key' // Your Supabase anon key
};
```

You can find these values in your existing Next.js app's `.env.local` file:
- `NEXT_PUBLIC_SUPABASE_URL` → `SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` → `SUPABASE_ANON_KEY`

### 3. Add Icons (Optional)

Add icon files to the `assets/` directory:
- `tray-icon.png` (16x16 or 32x32 for system tray)
- `icon.ico` (Windows app icon)  
- `icon.icns` (macOS app icon)
- `icon.png` (Linux app icon)

### 4. Run in Development

```bash
npm run dev
```

### 5. Build for Distribution

```bash
# Windows
npm run build-win

# macOS  
npm run build-mac

# Linux
npm run build-linux

# All platforms
npm run build
```

## Usage

1. **Start the widget**: The widget appears as a green circular button with "W" in the bottom-right corner
2. **Expand**: Click the widget or press `Ctrl+Shift+W` to expand the input form
3. **Write entry**: Type your work journal entry in the textarea
4. **Set status**: Choose "In Progress" or "Completed" from the dropdown
5. **Save**: Click "✨ SAVE" button or press `Ctrl+Enter`
6. **Auto-collapse**: Widget automatically collapses after saving
7. **System tray**: Right-click the tray icon to quit the app

## Keyboard Shortcuts

- `Ctrl+Shift+W` (`Cmd+Shift+W` on Mac) - Toggle widget expand/collapse
- `Ctrl+Enter` (`Cmd+Enter` on Mac) - Save entry when expanded
- `Escape` - Collapse widget when expanded

## Technical Details

- Built with Electron
- Direct integration with Supabase (same database as your web app)
- Transparent, frameless window that stays on top
- Automatically positions in bottom-right corner
- Auto-starts with system login
- System tray integration for easy quit

## Troubleshooting

1. **Widget not saving**: Check your Supabase credentials in the CONFIG object
2. **Global shortcut not working**: Make sure no other app is using Ctrl+Shift+W
3. **Widget not visible**: Check if it's hidden behind other windows or in system tray
4. **Auto-start not working**: Check your OS permissions for startup programs

## File Structure

```
electron-widget/
├── package.json          # Dependencies and build config
├── main.js              # Electron main process  
├── index.html           # Widget UI and logic
├── assets/              # Icon files
└── README.md           # This file
```

The widget replicates the exact look and functionality of your web app's entry input component, including the dark theme, styling, and save behavior.
