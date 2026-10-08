# Keeping the heat-index guide current

`guide-content.js` is the single source for both the in-app help and the printable `guide.html` page. When adding a feature, add its instructions and relevant control markers to `window.HEAT_INDEX_GUIDE`, and mark every new button, form control, and telephone link in `index.html` with `data-guide-control="..."`. The Pages workflow runs `scripts/validate-heat-index-guide.mjs`; it fails if an interactive control is missing from the guide or the guide refers to a missing control.

The guide renderer uses DOM text nodes rather than inserting guide text as HTML.
