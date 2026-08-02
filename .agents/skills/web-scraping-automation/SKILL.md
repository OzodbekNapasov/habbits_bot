---
name: web-scraping-automation
description: Web scraping, Puppeteer, Playwright, cheerio HTML parsing, and anti-bot handling.
---

# Web Scraping & Automation Skill

## Guidelines
1. **Respect Robots & Rate Limits**: Add delays between requests to avoid overloading target servers.
2. **Headless Browser Optimization**: Disable images, CSS, and fonts when automating for speed.
3. **Robust Selectors**: Use reliable data attributes or semantic selectors over fragile dynamic class names.
4. **Timeout Handling**: Always set explicit timeouts for element waiting and network idle.
5. **Resource Cleanup**: Close browser instances and pages in `finally` blocks.
