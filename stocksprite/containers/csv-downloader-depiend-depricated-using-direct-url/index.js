const { chromium } = require('playwright');
const fs = require('fs').promises; // Import fs.promises for async file operations

const LOGIN_URL = "https://www.depiend.hu/belepes";
const PRODUCTS_URL = "https://www.depiend.hu/egyediarjegyzek";
const EMAIL_ADDRESS = "info@agrogarden.hu";
const PASSWORD = "GeminiIkrek789";
const EXPECTED_PROFILE_TEXT = "Zsolt";
const EXPECTED_DOWNLOAD_BUTTON_TEXT = "Letöltés";
const DOWNLOAD_FILENAME = "/csv-provider-data/depiend-raw.csv";

// Function to log messages to file and console
async function log(message) {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  const localISOTime = new Date(now - offset).toISOString().slice(0, -1);
  const formattedMessage = `${localISOTime} - ${message}\n`;
  console.log(formattedMessage.trim());
  try {
    await fs.appendFile('log.log', formattedMessage); // Write to file
  } catch (error) {
    console.error(`Failed to write to log.log: ${error.message}`);
  }
}

// Helper function to verify profile text
async function verifyProfileText(page, selector, expectedText) {
  try {
    const element = await page.waitForSelector(selector, { timeout: 5000 }); // Added timeout for robustness
    const text = await element.textContent();
    if (text.trim() === expectedText) {
      await log(`Login successful: Profile element with text "${expectedText}" found.`);
      return true;
    } else {
      await log(`Login failed: Profile element text is not "${expectedText}". Found: "${text.trim()}".`);
      return false;
    }
  } catch (error) {
    await log(`Error verifying profile element "${selector}": ${error.message}`);
    return false;
  }
}

// Helper function to verify download button text or blocking message
async function verifyDownloadButtonText(page, downloadButtonSelector, expectedDownloadText) {
  const blockingTextFragment = "12 óránként egyszer tölthető le";

  // Check for the blocking message first
  const blockingLocator = page.locator('p.bc4', { hasText: blockingTextFragment });
  const isBlockingMessageVisible = await blockingLocator.isVisible({ timeout: 5000 }).catch(() => false);

  if (isBlockingMessageVisible) {
    const blockingText = await blockingLocator.textContent();
    // This check is technically redundant due to hasText on locator, but adds a layer of safety for text variations
    if (blockingText && blockingText.includes(blockingTextFragment)) {
      await log(`Download blocked: ${blockingText.trim()}`);
      return 'blocked';
    }
  }

  // If no specific blocking message is found or it doesn't match the expected text, check for the actual download button
  try {
    const element = await page.waitForSelector(downloadButtonSelector, { timeout: 5000, state: 'visible' });
    const text = await element.textContent();
    if (text && text.includes(expectedDownloadText)) {
      await log(`Download button with text "${expectedDownloadText}" found.`);
      return true;
    } else {
      await log(`Download button with text "${expectedDownloadText}" not found. Found: "${text ? text.trim() : 'null'}".`);
      return false;
    }
  } catch (error) {
    await log(`Error verifying download button "${downloadButtonSelector}": ${error.message}`);
    return false;
  }
}

// Function to delete all previous .webm video files
async function deletePreviousWebmFiles() {
  try {
    const files = await fs.readdir('./');
    const webmFiles = files.filter(file => file.endsWith('.webm'));
    for (const file of webmFiles) {
      const filePath = `./${file}`;
      await log(`Deleting previous video file: ${filePath}`);
      await fs.unlink(filePath);
    }
    await log('All previous .webm video files deleted.');
  } catch (error) {
    await log(`Error deleting previous video files: ${error.message}`);
  }
}

(async () => {
  await deletePreviousWebmFiles(); // Call the new function

  const browser = await chromium.launch();
  const context = await browser.newContext({
    recordVideo: { dir: './' } // Record video to the current directory
  });
  const page = await context.newPage();

  await page.goto(LOGIN_URL);
  await page.type("#email", EMAIL_ADDRESS);
  await page.type("#password", PASSWORD);
  try {
    await page.locator('button:has-text("Elfogadom")').click({ timeout: 5000 });
    await log("Cookie accept button \"Elfogadom\" clicked (if present).");
  } catch (e) {
    await log("Cookie accept button \"Elfogadom\" not found or already handled, continuing...");
  }
  await page.click(".js-submit-button");
  await page.screenshot({ path: "screenshot_after_login_attempt.png" });
  await log(`Current URL after login attempt: ${await page.url()}`);
  await log(`Current Page Title after login attempt: ${await page.title()}`);

  const loginSuccess = await verifyProfileText(page, "p.js-open-profile-menu", EXPECTED_PROFILE_TEXT);
  if (!loginSuccess) {
    await log('Login verification failed. Exiting.');
    await context.close(); // Close context before browser
    await browser.close();
    return;
  }

  await page.goto(PRODUCTS_URL);

  const downloadStatus = await verifyDownloadButtonText(page, 'button[name="sbm"].btn--secondary', EXPECTED_DOWNLOAD_BUTTON_TEXT);
  if (downloadStatus === 'blocked') {
    await log('File download is currently blocked. Script will exit.');
    await context.close(); // Close context before browser
    await browser.close();
    return;
  } else if (!downloadStatus) { // This means downloadStatus is false (button not found)
    await log('Download button verification failed or button not found. Script will exit.');
    await context.close(); // Close context before browser
    await browser.close();
    return;
  }

  // Handle file download (only if downloadStatus is true)
  await log('Attempting to click download button and handle download...');
  const [download] = await Promise.all([
    page.waitForEvent('download'), // Wait for the download to start
    page.click("button[name=\"sbm\"].btn--secondary") // Click the button that triggers the download
  ]);

  const downloadPath = DOWNLOAD_FILENAME; // Save as depiend.csv
  await download.saveAs(downloadPath);
  await log(`File downloaded to: ${downloadPath}`);

  await context.close(); // Close context to finalize video recording
  await browser.close();
  await log('Browser closed after download. Video recorded by Playwright.');
})();