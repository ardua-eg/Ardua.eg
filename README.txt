ARDUA store — deployment and setup

FILES
- index.html: store front-end, cart, checkout, interactive photo-view switcher, cookie choice UI
- img/: product photos and brand assets
- privacy.html, cookies.html, terms.html, refunds.html: store policy pages

ORDERS
The current index.html has a Formspree endpoint configured. Confirm that it belongs to your account and that order notifications arrive at the intended email before launch. Never put secret API keys in this static HTML file. Test an order using your own details, then remove the test order from the order inbox if needed.

PRODUCTS
Active products and prices are in the PRODUCTS array in index.html. The Washed Cap has been moved to a Coming Soon section and is not orderable. Edit the Coming Soon section when you are ready to launch it.

COOKIE CHOICES
The store currently has no analytics or advertising trackers enabled. Cart functionality uses essential browser localStorage. The optional analytics preference is a saved choice only; it does not load analytics. If analytics or third-party tracking is added in the future, connect the consent choice to the tracker and update the policy before enabling it.

INTERACTIVE HERO
The hero lets visitors drag horizontally or use arrow keys to switch among existing cap photos. This is a photo-view switcher, not a true 360-degree product capture. A genuine 360 spin requires a sequence of photos taken around the actual cap.

DEPLOY
Upload the complete folder (index.html, all policy HTML files and the img folder) to your host. Keep the file/folder structure unchanged. Test mobile layout, checkout, order notifications and policy links after deployment.

IMPORTANT
The policy pages are starting drafts and should be checked against your actual business, contact details and applicable law before launch. No live deployment was performed by this update.
