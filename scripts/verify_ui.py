import subprocess
import time
import os
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

import urllib.request

ROOT_DIR = Path(__file__).resolve().parent.parent
ARTIFACT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "screenshots")
os.makedirs(ARTIFACT_DIR, exist_ok=True)

def wait_for_server(url, timeout=15):
    start = time.time()
    while time.time() - start < timeout:
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Playwright-Check"})
            with urllib.request.urlopen(req, timeout=1) as resp:
                if resp.status == 200:
                    return True
        except Exception:
            time.sleep(0.3)
    raise RuntimeError(f"Dev server failed to respond at {url} within {timeout}s")

def verify_bundle_size():
    dist_astro = Path(__file__).resolve().parent.parent / "dist" / "_astro"
    if not dist_astro.exists():
        raise RuntimeError(f"Directory {dist_astro} does not exist. Run `bun run build` first.")
    
    entry_chunks = [p for p in dist_astro.glob("*.js") if "echarts" not in p.name.lower()]
    if not entry_chunks:
        raise RuntimeError("No entry JS chunks found in dist/_astro.")
    
    largest_entry = max(path.stat().st_size for path in entry_chunks)
    print(f"Largest initial JS chunk size: {largest_entry:,} bytes ({largest_entry / 1024:.1f} KB)")
    for p in entry_chunks:
        print(f"  - {p.name}: {p.stat().st_size:,} bytes")
    
    assert largest_entry < 700_000, f"Initial JS chunk too large: {largest_entry:,} bytes (exceeds 700,000 bytes budget)"
    print("✓ Bundle size check passed (< 700KB budget)")

def run():
    if "--bundle-only" in sys.argv:
        verify_bundle_size()
        return

    verify_bundle_size()

    console_errors = []

    def attach_page_listeners(p, name):
        def handle_console(msg):
            text = msg.text
            if msg.type in ("error", "warning"):
                print(f"[{name}] Console ({msg.type}): {text}")
            if msg.type == "error":
                console_errors.append(f"[{name}] Console Error: {text}")
            elif "Can't get DOM width or height" in text or "zero-size" in text.lower():
                console_errors.append(f"[{name}] ECharts Warning: {text}")
        p.on("console", handle_console)
        p.on("pageerror", lambda err: (print(f"[{name}] Page Error: {err}"), console_errors.append(f"[{name}] Page Error: {err}")))

    print("Starting Astro preview server on http://127.0.0.1:4399...")
    server = subprocess.Popen(
        ["bun", "x", "astro", "preview", "--port", "4399", "--host", "127.0.0.1"],
        cwd=str(ROOT_DIR),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    wait_for_server("http://127.0.0.1:4399")
    print("✓ Preview server ready on http://127.0.0.1:4399")

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)

            # =========================================================================
            # 1. Desktop Viewport (1440x900)
            # =========================================================================
            print("\n--- Testing Desktop Viewport (1440x900) ---")
            context = browser.new_context(viewport={"width": 1440, "height": 900}, color_scheme="dark")
            page = context.new_page()
            attach_page_listeners(page, "Desktop")
            page.goto("http://127.0.0.1:4399")
            page.wait_for_load_state("domcontentloaded")
            page.wait_for_selector(".pro-table-row", timeout=15000)
            page.wait_for_timeout(800)

            # Ensure initial dark mode
            page.evaluate("document.documentElement.classList.add('dark')")
            page.wait_for_timeout(300)

            # 1a. Table View Default
            page.screenshot(path=os.path.join(ARTIFACT_DIR, "screenshot_desktop_dark_table_default.png"))
            print("✓ Captured: screenshot_desktop_dark_table_default.png")

            # 1b. Test Theme Switcher (Dark -> Light -> Dark) & Reactive ARIA Label
            theme_btn = page.locator("header button[title='Toggle dark/light theme']")
            aria_label_dark = theme_btn.get_attribute("aria-label")
            assert aria_label_dark == "Switch to light theme", f"Unexpected aria-label: {aria_label_dark}"
            
            theme_btn.click()
            page.wait_for_timeout(400)
            aria_label_light = theme_btn.get_attribute("aria-label")
            assert aria_label_light == "Switch to dark theme", f"Unexpected aria-label: {aria_label_light}"
            page.screenshot(path=os.path.join(ARTIFACT_DIR, "screenshot_desktop_light_table.png"))
            print("✓ Captured: screenshot_desktop_light_table.png")

            # Toggle back to Dark
            theme_btn.click()
            page.wait_for_timeout(400)

            # 1c. Search Filter & Clear
            search_input = page.locator("#search-input")
            search_input.fill("claude")
            page.wait_for_timeout(300)
            filtered_count = page.locator(".pro-table-row").count()
            assert filtered_count > 0, "Expected search results for 'claude'"
            print(f"✓ Search 'claude' filtered to {filtered_count} models")

            # Clear search
            page.locator("button[aria-label='Clear search']").first.click()
            page.wait_for_timeout(300)
            total_count = page.locator(".pro-table-row").count()
            assert total_count > filtered_count, "Expected full model list after clear"

            # 1d. Table Column Header Sorting
            iq_th = page.locator("th:has-text('Quality (IQ)')")
            assert iq_th.get_attribute("aria-sort") == "descending", "Default sort should be IQ descending"
            iq_th.locator("button").click()
            page.wait_for_timeout(300)
            assert iq_th.get_attribute("aria-sort") == "ascending", "Sort should toggle to IQ ascending"
            iq_th.locator("button").click()
            page.wait_for_timeout(300)
            assert iq_th.get_attribute("aria-sort") == "descending", "Sort should toggle back to IQ descending"

            # 1e. Compare Mode Flow
            compare_btn = page.locator("header button[aria-label='Toggle comparison']")
            assert compare_btn.get_attribute("aria-pressed") == "false"
            compare_btn.click()
            page.wait_for_timeout(300)
            assert compare_btn.get_attribute("aria-pressed") == "true"
            page.screenshot(path=os.path.join(ARTIFACT_DIR, "screenshot_desktop_dark_table_compare_toggled.png"))
            print("✓ Captured: screenshot_desktop_dark_table_compare_toggled.png")

            # Check first two models
            checkboxes = page.locator("tbody input[type='checkbox']")
            checkboxes.nth(0).click()
            page.wait_for_timeout(200)
            checkboxes.nth(1).click()
            page.wait_for_timeout(200)

            # Click Apply & Compare
            apply_btn = page.locator("button:has-text('Apply & Compare')")
            assert apply_btn.is_visible(), "Apply & Compare banner should be visible"
            apply_btn.click()
            page.wait_for_timeout(400)
            page.screenshot(path=os.path.join(ARTIFACT_DIR, "screenshot_desktop_dark_compare.png"))
            print("✓ Captured: screenshot_desktop_dark_compare.png")

            # Back to Table
            page.locator("button:has-text('Back to Table')").click()
            page.wait_for_timeout(300)

            # 1f. Cards View
            page.evaluate("() => { const d = Alpine.$data(document.querySelector('[x-data]')); d.modelsViewMode = 'cards'; }")
            page.wait_for_timeout(600)
            page.wait_for_selector("#panel-cards .model-card", timeout=5000)
            page.screenshot(path=os.path.join(ARTIFACT_DIR, "screenshot_desktop_dark_cards.png"))
            print("✓ Captured: screenshot_desktop_dark_cards.png")

            # 1g. Scatter Plot View (Modular Lazy Loaded ECharts)
            page.evaluate("() => { const d = Alpine.$data(document.querySelector('[x-data]')); d.modelsViewMode = 'plot'; }")
            page.wait_for_timeout(1000)
            page.wait_for_selector("#echarts-container svg", timeout=5000)
            page.screenshot(path=os.path.join(ARTIFACT_DIR, "screenshot_desktop_dark_plot.png"))
            print("✓ Captured: screenshot_desktop_dark_plot.png")

            # Test plot metrics switching
            page.evaluate("() => { const d = Alpine.$data(document.querySelector('[x-data]')); d.plotMetric = 'iq-speed'; }")
            page.wait_for_timeout(500)
            page.evaluate("() => { const d = Alpine.$data(document.querySelector('[x-data]')); d.plotMetric = 'ttft-speed'; }")
            page.wait_for_timeout(500)
            page.evaluate("() => { const d = Alpine.$data(document.querySelector('[x-data]')); d.plotMetric = 'iq-cost'; }")
            page.wait_for_timeout(500)

            # 1h. SOTA Timeline View
            page.evaluate("() => { const d = Alpine.$data(document.querySelector('[x-data]')); d.modelsViewMode = 'timeline'; }")
            page.wait_for_timeout(1000)
            page.wait_for_selector("#echarts-container svg", timeout=5000)
            page.screenshot(path=os.path.join(ARTIFACT_DIR, "screenshot_desktop_dark_timeline.png"))
            print("✓ Captured: screenshot_desktop_dark_timeline.png")

            # 1i. Model Drawer Inspector (Docked sheet on desktop)
            page.evaluate("() => { const d = Alpine.$data(document.querySelector('[x-data]')); d.modelsViewMode = 'table'; d.openModelDrawer(d.data.models[0]); }")
            page.wait_for_timeout(600)
            page.wait_for_selector("aside[aria-label='Model Inspector Panel']", timeout=5000)
            page.screenshot(path=os.path.join(ARTIFACT_DIR, "screenshot_desktop_dark_drawer.png"))
            print("✓ Captured: screenshot_desktop_dark_drawer.png")

            # Test workload presets inside drawer
            page.locator("aside[aria-label='Model Inspector Panel'] button:has-text('Agent')").first.click()
            page.wait_for_timeout(200)
            page.locator("aside[aria-label='Model Inspector Panel'] button:has-text('RAG')").first.click()
            page.wait_for_timeout(200)

            # Close drawer via Escape
            page.keyboard.press("Escape")
            page.wait_for_timeout(400)
            assert not page.locator("aside[aria-label='Model Inspector Panel']").is_visible(), "Drawer should be closed after Escape"

            context.close()

            # =========================================================================
            # 2. Tablet Viewport (768x1024)
            # =========================================================================
            print("\n--- Testing Tablet Viewport (768x1024) ---")
            tab_context = browser.new_context(viewport={"width": 768, "height": 1024}, color_scheme="dark")
            tab_page = tab_context.new_page()
            attach_page_listeners(tab_page, "Tablet")
            tab_page.goto("http://127.0.0.1:4399")
            tab_page.wait_for_load_state("domcontentloaded")
            tab_page.wait_for_selector(".pro-table-row", timeout=15000)
            tab_page.evaluate("document.documentElement.classList.add('dark')")
            tab_page.wait_for_timeout(800)

            # Assert no horizontal page-level overflow
            has_overflow = tab_page.evaluate("() => document.documentElement.scrollWidth > document.documentElement.clientWidth")
            assert not has_overflow, "Tablet layout has horizontal page overflow!"
            print("✓ Verified: No horizontal page overflow on tablet")

            tab_page.screenshot(path=os.path.join(ARTIFACT_DIR, "screenshot_tablet_dark_table.png"))
            print("✓ Captured: screenshot_tablet_dark_table.png")

            tab_context.close()

            # =========================================================================
            # 3. Mobile Viewport (390x844)
            # =========================================================================
            print("\n--- Testing Mobile Viewport (390x844) ---")
            mob_context = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, color_scheme="dark")
            mob_page = mob_context.new_page()
            attach_page_listeners(mob_page, "Mobile")
            mob_page.goto("http://127.0.0.1:4399")
            mob_page.wait_for_load_state("domcontentloaded")
            mob_page.wait_for_selector(".model-card", timeout=15000)
            mob_page.evaluate("document.documentElement.classList.add('dark')")
            mob_page.wait_for_timeout(800)

            # Assert no horizontal overflow on mobile
            mob_overflow = mob_page.evaluate("() => document.documentElement.scrollWidth > document.documentElement.clientWidth")
            assert not mob_overflow, "Mobile layout has horizontal page overflow!"
            print("✓ Verified: No horizontal page overflow on mobile")

            # 3a. Mobile Table Screenshot
            mob_page.screenshot(path=os.path.join(ARTIFACT_DIR, "screenshot_mobile_dark_table.png"))
            print("✓ Captured: screenshot_mobile_dark_table.png")

            # 3b. Verify Mobile Floating Navigation and Target Sizes
            mob_nav = mob_page.locator("nav[aria-label='Mobile Navigation']")
            assert mob_nav.is_visible(), "Mobile bottom nav should be visible"
            nav_buttons = mob_nav.locator("button")
            btn_count = nav_buttons.count()
            assert btn_count >= 4, f"Expected 4 mobile nav buttons, got {btn_count}"
            for i in range(btn_count):
                box = nav_buttons.nth(i).bounding_box()
                assert box is not None and box["height"] >= 34 and box["width"] >= 40, f"Nav button {i} too small: {box}"
            print("✓ Verified: Mobile navigation touch target sizes compliant")

            # 3c. Mobile Cards View
            cards_nav_btn = mob_nav.locator("button[aria-label='Cards View']")
            cards_nav_btn.click()
            mob_page.wait_for_timeout(600)
            mob_page.wait_for_selector("#panel-cards .model-card", timeout=5000)
            mob_page.screenshot(path=os.path.join(ARTIFACT_DIR, "screenshot_mobile_dark_cards.png"))
            print("✓ Captured: screenshot_mobile_dark_cards.png")

            # 3d. Mobile Inspector: Focus Trap, Escape, and Focus Restoration
            inspect_trigger = mob_page.locator("#panel-cards .model-card").first
            inspect_trigger.focus()
            inspect_trigger.click()
            mob_page.wait_for_timeout(600)
            mob_page.wait_for_selector("div[role='dialog']", timeout=5000)
            
            # Check focus moved inside drawer
            active_inside_drawer = mob_page.evaluate("""() => {
                const drawer = document.querySelector("div[role='dialog']");
                return drawer && drawer.contains(document.activeElement);
            }""")
            assert active_inside_drawer, "Focus was not moved into the inspector drawer on open"
            print("✓ Verified: Focus moved into inspector drawer")

            mob_page.screenshot(path=os.path.join(ARTIFACT_DIR, "screenshot_mobile_dark_drawer.png"))
            print("✓ Captured: screenshot_mobile_dark_drawer.png")

            # Press Escape to close
            mob_page.keyboard.press("Escape")
            mob_page.wait_for_timeout(400)
            assert not mob_page.locator("div[role='dialog']").is_visible(), "Drawer should be closed after Escape"

            # Check focus restored to trigger
            focus_restored = mob_page.evaluate("""() => {
                const active = document.activeElement;
                return active && (active.classList.contains('model-card') || active.closest('.model-card'));
            }""")
            assert focus_restored, "Focus was not restored to inspect trigger card after closing drawer"
            print("✓ Verified: Focus correctly restored to trigger after closing drawer")

            mob_context.close()
            browser.close()

            # Assert no console errors or ECharts warnings
            if console_errors:
                print("\nCaptured Console Warnings/Errors:")
                for err in console_errors:
                    print(f"  ❌ {err}")
                raise AssertionError(f"Encountered {len(console_errors)} console errors/warnings during verification")
            else:
                print("✓ Verified: Zero console errors or ECharts warnings")

            print("\n=======================================================")
            print("ALL MULTI-VIEWPORT VERIFICATION CHECKS PASSED!")
            print("=======================================================")

    finally:
        server.terminate()
        try:
            server.wait(timeout=2)
        except Exception:
            pass
        subprocess.run(["bun", "x", "astro", "preview", "stop"], cwd=str(ROOT_DIR), capture_output=True)

if __name__ == "__main__":
    run()
