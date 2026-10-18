ARDUA store - how to put it online (Vercel + GitHub)

IMPORTANT: index.html must sit at the TOP LEVEL of your GitHub repository,
next to the other files. If it is inside a folder, Vercel shows "404 NOT_FOUND".

1. Unzip this file. You get about 25 files (html, css, js, images, fonts).
2. On github.com open your ardua repository. Delete the old files first:
   open each old file > bin icon > Commit changes (or create a new repository).
3. Tap Add file > Upload files. Select ALL the unzipped files (not the zip, not a folder)
   and upload them. Tap Commit changes.
4. Vercel redeploys on its own within a minute. Open your vercel.app link.

Things you can edit (open the file on GitHub, tap the pencil, Commit changes):
- config.js      contact email and phone shown on the legal pages, the order form address,
                 and the number of days a customer has to report a damaged item.
- app.js         product names, prices and descriptions (top of the file).
- index.html     the Coming soon section (washed cap).

Orders arrive by email through Formspree. Test with a real order after each change.
Fonts: Outfit and IBM Plex Mono, SIL Open Font License (see FONT-LICENSES.txt).

ORDER CONFIRMATION BY WHATSAPP
Put your WhatsApp number (country code, digits only) in config.js as whatsappNumber.
After ordering, the customer taps a button that opens WhatsApp with a ready message.
