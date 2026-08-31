import subprocess
import time
import os
import sys
from playwright.sync_api import sync_playwright

ARTIFACT_DIR = "/home/quantavil/.gemini/antigravity-ide/brain/a19c0811-1f27-4394-94d5-7b6a681b67bb"
os.makedirs(ARTIFACT_DIR, exist_ok=True)

def run():
    print("Starting Astro dev server...")
    server = subprocess.Popen(["bun", "run", "dev", "--port", "4321"], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    time.sleep(3)  # wait for dev server to start

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            
            # --- 1. Desktop Dark Mode (1440x900) ---
            context = browser.new_context(viewport={"width": 1440, "height": 900}, color_scheme="dark")
            page = context.new_page()
            page.goto("http://localhost:4321")
            page.wait_for_load_state("domcontentloaded")
            page.wait_for_selector(".pro-table-row", timeout=15000)
            page.wait_for_timeout(800)

            # Ensure dark mode
            page.evaluate("document.documentElement.classList.add('dark')")
            page.wait_for_timeout(400)

            # 1a. Table View (Default: VS column hidden, top Compare button beside sync)
            page.screenshot(path=os.path.join(ARTIFACT_DIR, "screenshot_desktop_dark_table_default.png"))
            print("Captured: screenshot_desktop_dark_table_default.png")

            # 1b. Click Top Header Compare button (beside sync) -> Toggles VS column and shows Apply banner
            page.locator("header button[aria-label='Toggle comparison']").click()
            page.wait_for_timeout(400)
            page.screenshot(path=os.path.join(ARTIFACT_DIR, "screenshot_desktop_dark_table_compare_toggled.png"))
            print("Captured: screenshot_desktop_dark_table_compare_toggled.png")

            # Check 2 models via VS checkboxes in the table
            page.locator("tbody input[type='checkbox']").nth(0).click()
            page.wait_for_timeout(200)
            page.locator("tbody input[type='checkbox']").nth(1).click()
            page.wait_for_timeout(200)

            # 1c. Click Apply & Compare button on banner -> Goes to Compare Section
            page.locator("button:has-text('Apply & Compare')").click()
            page.wait_for_timeout(400)
            page.screenshot(path=os.path.join(ARTIFACT_DIR, "screenshot_desktop_dark_compare.png"))
            print("Captured: screenshot_desktop_dark_compare.png")

            # 1d. Click Back to Table -> Returns to Table View
            page.locator("button:has-text('Back to Table')").click()
            page.wait_for_timeout(300)

            # 1e. Cards View
            page.evaluate("() => { const d = Alpine.$data(document.querySelector('[x-data]')); d.modelsViewMode = 'cards'; }")
            page.wait_for_timeout(600)
            page.screenshot(path=os.path.join(ARTIFACT_DIR, "screenshot_desktop_dark_cards.png"))
            print("Captured: screenshot_desktop_dark_cards.png")

            # 1f. Scatter Plot View
            page.evaluate("() => { const d = Alpine.$data(document.querySelector('[x-data]')); d.modelsViewMode = 'plot'; }")
            page.wait_for_timeout(1000)
            page.screenshot(path=os.path.join(ARTIFACT_DIR, "screenshot_desktop_dark_plot.png"))
            print("Captured: screenshot_desktop_dark_plot.png")

            # 1g. SOTA Timeline View
            page.evaluate("() => { const d = Alpine.$data(document.querySelector('[x-data]')); d.modelsViewMode = 'timeline'; }")
            page.wait_for_timeout(1000)
            page.screenshot(path=os.path.join(ARTIFACT_DIR, "screenshot_desktop_dark_timeline.png"))
            print("Captured: screenshot_desktop_dark_timeline.png")

            # 1g. Model Drawer Inspector (Open first model)
            page.evaluate("() => { const d = Alpine.$data(document.querySelector('[x-data]')); d.modelsViewMode = 'table'; d.openModelDrawer(d.data.models[0]); }")
            page.wait_for_timeout(600)
            page.screenshot(path=os.path.join(ARTIFACT_DIR, "screenshot_desktop_dark_drawer.png"))
            print("Captured: screenshot_desktop_dark_drawer.png")

            # Close drawer
            page.evaluate("() => { const d = Alpine.$data(document.querySelector('[x-data]')); d.closeModelDrawer(); }")
            page.wait_for_timeout(300)

            # --- 2. Desktop Light Mode ---
            page.evaluate("() => { const d = Alpine.$data(document.querySelector('[x-data]')); d.toggleTheme(); }")
            page.wait_for_timeout(500)
            page.screenshot(path=os.path.join(ARTIFACT_DIR, "screenshot_desktop_light_table.png"))
            print("Captured: screenshot_desktop_light_table.png")

            # Light Mode Drawer
            page.evaluate("() => { const d = Alpine.$data(document.querySelector('[x-data]')); d.openModelDrawer(d.data.models[0]); }")
            page.wait_for_timeout(600)
            page.screenshot(path=os.path.join(ARTIFACT_DIR, "screenshot_desktop_light_drawer.png"))
            print("Captured: screenshot_desktop_light_drawer.png")

            page.evaluate("() => { const d = Alpine.$data(document.querySelector('[x-data]')); d.closeModelDrawer(); }")
            context.close()

            # --- 3. Mobile Viewport (375x812) Dark Mode ---
            mob_context = browser.new_context(viewport={"width": 375, "height": 812}, is_mobile=True, color_scheme="dark")
            mob_page = mob_context.new_page()
            mob_page.goto("http://localhost:4321")
            mob_page.wait_for_load_state("domcontentloaded")
            mob_page.wait_for_selector(".pro-table-row", timeout=15000)
            mob_page.evaluate("document.documentElement.classList.add('dark')")
            mob_page.wait_for_timeout(800)

            mob_page.screenshot(path=os.path.join(ARTIFACT_DIR, "screenshot_mobile_dark_table.png"))
            print("Captured: screenshot_mobile_dark_table.png")

            # Open Mobile Drawer
            mob_page.evaluate("() => { const d = Alpine.$data(document.querySelector('[x-data]')); d.openModelDrawer(d.data.models[0]); }")
            mob_page.wait_for_timeout(600)
            mob_page.screenshot(path=os.path.join(ARTIFACT_DIR, "screenshot_mobile_dark_drawer.png"))
            print("Captured: screenshot_mobile_dark_drawer.png")

            mob_context.close()
            browser.close()
            print("ALL SCREENSHOTS CAPTURED SUCCESSFULLY!")

    finally:
        server.terminate()
        server.wait()

if __name__ == "__main__":
    run()
