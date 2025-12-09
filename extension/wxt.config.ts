import { defineConfig } from 'wxt';

export default defineConfig({
  extensionApi: 'chrome',
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: "Re:Mark",
    description: "AI-enhanced bookmark knowledge base",
    default_locale: 'en',
    permissions: ['storage', 'bookmarks', 'notifications'],
    host_permissions: [
      "https://api.github.com/*",
      "https://gist.githubusercontent.com/*",
      "https://raw.githubusercontent.com/*",
      "http://localhost:*/*"
    ],
    optional_host_permissions: ["https://*/*"],
    icons: {
      "16": "icon/16.png",
      "32": "icon/32.png",
      "48": "icon/48.png",
      "128": "icon/128.png"
    },
    action: {
      default_icon: {
        "16": "icon/16.png",
        "32": "icon/32.png",
        "48": "icon/48.png",
        "128": "icon/128.png"
      }
    }
  }
});
