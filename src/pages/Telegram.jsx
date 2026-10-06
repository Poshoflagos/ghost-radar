export default function Telegram() {
  return (
    <div className="space-y-6">
      <h1 className="text-4xl font-black">Telegram Alerts</h1>
      <div className="card p-6 space-y-4">
        <p className="muted">V1 sends research alerts to one admin Telegram chat or private channel. User-specific Telegram accounts come later.</p>
        <ol className="list-decimal pl-5 space-y-2">
          <li>Open Telegram and search for <b>@BotFather</b>.</li>
          <li>Create a bot with <b>/newbot</b>.</li>
          <li>Copy the bot token into Netlify environment variable <b>TELEGRAM_BOT_TOKEN</b>.</li>
          <li>Send <b>/start</b> to your bot.</li>
          <li>Open the getUpdates URL to retrieve your chat ID.</li>
          <li>Save it as <b>TELEGRAM_CHAT_ID</b> on Netlify.</li>
          <li>Use the scanner page and click <b>Send Research Alert to Telegram</b>.</li>
        </ol>
      </div>
      <div className="card p-6">
        <h2 className="text-xl font-black mb-2">Alert language rule</h2>
        <p className="muted">Alerts must say “Research Alert,” not “Buy Signal.” This product does not tell users what to buy.</p>
      </div>
    </div>
  );
}
