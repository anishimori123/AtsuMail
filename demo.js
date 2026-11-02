// Fake data so you can try the design without connecting Gmail.
window.ATSU_DEMO = {
  labels: [
    { id: "INBOX", name: "INBOX", type: "system", unread: 3 },
    { id: "STARRED", name: "STARRED", type: "system" },
    { id: "SENT", name: "SENT", type: "system" },
    { id: "DRAFT", name: "DRAFT", type: "system" },
    { id: "SPAM", name: "SPAM", type: "system" },
    { id: "TRASH", name: "TRASH", type: "system" },
    { id: "L1", name: "Trading", type: "user" },
    { id: "L2", name: "Trading/Broker", type: "user" },
    { id: "L3", name: "Receipts", type: "user" }
  ],
  messages: [
    { id: "m0", labels: ["INBOX"], unread: true, from: "The Weekly Market Letter", subject: "Issue #42: Why small bots beat big ones", snippet: "This week: three lessons from a year of automated trading", date: Date.now() - 600e3,
      html: "<table width='600' bgcolor='#f4f1ea' style='font-family:Arial;color:#333'><tr><td style='padding:24px'>" +
        "<img src='x' width='1' height='1'><h1 style='color:#8b0000;font-size:28px'>Why small bots beat big ones</h1>" +
        "<p style='font-size:12px;color:#777'>Issue #42 &middot; 9 min read</p>" +
        Array.from({ length: 8 }, (_, i) => `<h2>Lesson ${i + 1}</h2><p style='font-size:13px'>` + "Simple rules you understand are easier to fix than clever rules you don't. Start with one market, one timeframe and one idea, and keep a log of every trade the bot makes. ".repeat(4) + "</p>").join("") +
        "<p><a href='https://example.com'>Read on the web</a></p></td></tr></table>" },
    { id: "m1", labels: ["INBOX"], unread: true, from: "Broker Alerts", subject: "Order filled: 10 AAPL", snippet: "Your limit order was filled at", date: Date.now() - 3600e3,
      html: "<h3>Order filled</h3><p>Your limit order for <b>10 AAPL</b> was filled at <b>$231.40</b>.</p><p>Thank you for trading.</p>" },
    { id: "m2", labels: ["INBOX"], unread: true, from: "GitHub", subject: "[AtsuMail] Welcome to your new repo", snippet: "You just created a repository", date: Date.now() - 86400e3,
      text: "Hi Atsushi,\n\nYou just created the repository anishimori123/AtsuMail.\n\nHappy coding!" },
    { id: "m3", labels: ["INBOX", "L3"], unread: true, from: "Amazon.com", subject: "Your order has shipped", snippet: "Arriving Tuesday", date: Date.now() - 2 * 86400e3,
      html: "<table width='100%' style='background:#fff;color:#111'><tr><td style='padding:20px'><h2>Your package is on the way</h2><p>Arriving <b>Tuesday</b>.</p><p>" + "This is a long email to test scrolling. ".repeat(60) + "</p></td></tr></table>" },
    { id: "m4", labels: ["INBOX", "L1"], from: "Bot Log", subject: "Daily P/L report", snippet: "+1.2% today", date: Date.now() - 5 * 86400e3,
      text: "Daily report\n------------\nTrades: 4\nP/L: +1.2%\n" },
    { id: "m5", labels: ["SENT"], from: "me", subject: "Re: meeting", snippet: "Sounds good", date: Date.now() - 9 * 86400e3, text: "Sounds good, see you then." }
  ]
};
