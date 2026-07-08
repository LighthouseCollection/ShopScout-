# ShopScout — Smart Product Comparison Browser Extension

ShopScout is a smart browser extension designed to help shoppers collect, organize, compare, verify, and analyze products from different shopping websites. Instead of manually copying product names, prices, links, specifications, and notes into a spreadsheet, ShopScout captures product information directly from product pages and prepares it for intelligent comparison.

The goal of ShopScout is simple: **help the user make a better buying decision with less manual work.**

## How ShopScout Works

When the user visits a product page, ShopScout detects and extracts important product information from the page. This may include the product title, price, used or refurbished price, brand, manufacturer, model number, rating, review count, product image, product URL, source website, product details, feature bullets, and available specifications.

Because every shopping website structures product pages differently, ShopScout uses site-specific extraction logic. Amazon, Walmart, Costco, Best Buy, eBay, Temu, and other marketplaces may each display prices, models, ratings, descriptions, and specifications in different locations. ShopScout normalizes this information into one consistent product record so products from different stores can be compared side by side.

Once a product is captured, ShopScout saves it into a selected product list. The user can create multiple lists, rename lists, delete lists, switch between lists, and organize products by shopping goal, project, category, or purchase decision.

## Popup View

The popup is the quick capture area. It allows the user to add the current product, select the active list, view recently saved products, and open the full comparison page.

The popup is designed for speed while shopping. The user does not need to stop browsing, open a spreadsheet, or manually copy product details. They can simply add the product and continue shopping.

## Full Comparison Page

The full comparison page gives the user a larger workspace for evaluating saved products. Products can be viewed as cards or in a comparison table. The comparison page allows products to be reviewed side by side using fields such as product name, brand, manufacturer, price, used/refurbished price, source, model number, rating, reviews, notes, URL, extracted details, and specifications.

This page can also serve as a saved reference document. The user can save or export the comparison as an HTML page or PDF so the research can be deferred to later, shared with someone else, archived for future reference, or used as a record of the buying decision.

The full comparison page supports sorting, filtering, product removal, list management, export/import, and AI-ready comparison output. This makes it useful not only for quick shopping, but also for serious research, purchasing decisions, and documentation.

## AI-Powered Product Analysis

ShopScout prepares product data for AI analysis in a structured and intelligent way. The AI prompt does not simply ask, “Which product is best?” Instead, it guides the AI to determine whether the products are actually comparable, identify their categories, evaluate the right quality factors for each category, verify specifications when possible, detect missing information, and check whether two listings may be the same underlying product sold under different names.

This allows ShopScout to support smarter comparisons. A TV should not be judged by the same standards as clothing. A desk should not be evaluated like a laptop. A car organizer should not be compared directly against a baseball hat. ShopScout helps the AI understand what kind of product is being evaluated before asking for a recommendation.

## Category-Aware Intelligence

ShopScout uses category-aware comparison. This means it recognizes that different product categories have different quality standards.

For example:

- Electronics are evaluated by technical specifications, performance, compatibility, ports, software support, reliability, and warranty.
- Clothing is evaluated by material, fit, sizing accuracy, stitching, comfort, durability, care requirements, and return policy.
- Furniture is evaluated by frame material, dimensions, weight capacity, construction quality, comfort, assembly, durability, and warranty.
- Appliances are evaluated by capacity, energy use, reliability, installation requirements, serviceability, and warranty.
- Automotive accessories are evaluated by compatibility, material durability, installation, fitment accuracy, safety impact, and value.
- Grocery and food items are evaluated by ingredients, freshness, nutrition, allergens, expiration date, certifications, and price per unit.

ShopScout’s comparison logic is therefore not generic. It adapts to the product category being analyzed.

## Specification Extraction

ShopScout captures product specifications from the product listing whenever they are available. Product title and price are not enough for a good buying decision. A proper comparison may require details such as dimensions, weight, material, compatibility, warranty, included items, color, size, capacity, model number, SKU, UPC, GTIN, MPN, product bullets, description, seller name, and manufacturer information.

These specifications allow the user and the AI to compare products more accurately. They also help identify whether two products are truly different or simply the same product listed under different names.

## Manufacturer Verification

Marketplace listings can be incomplete, exaggerated, or inaccurate. ShopScout is designed to support verification against official manufacturer information when possible.

The ideal workflow is:

1. Collect product data from the marketplace listing.
2. Extract product specifications from the product page.
3. Identify model numbers, UPCs, GTINs, MPNs, SKUs, or other product identifiers.
4. Compare the listing information against official manufacturer specifications when possible.
5. Flag missing information, conflicts, suspicious claims, or unverifiable details.

This helps prevent poor buying decisions based on misleading marketplace titles, incomplete descriptions, or incorrect specifications.

## Rebrand and Duplicate Product Detection

ShopScout also supports detection of possible rebranded or duplicate products.

This is important because online marketplaces often contain products that appear under different brand names but may be the same underlying item. The same product may be sold with different titles, different logos, slightly different images, and different prices.

ShopScout looks for matching signals such as:

- Same or similar product images
- Same dimensions
- Same material
- Same weight
- Same model number
- Same UPC, GTIN, MPN, or SKU
- Same feature bullets
- Same description wording
- Same included accessories
- Same manufacturer or importer
- Same manual or specification sheet

If two products appear to be the same underlying item, ShopScout can flag that and help the user avoid paying a higher price for a rebranded version of the same product.

## Why ShopScout Is Useful

ShopScout saves time, reduces confusion, and improves buying decisions. Instead of comparing products manually across many browser tabs, the user can build a structured product list, review the products side by side, save the comparison for later, and use AI to produce a thoughtful recommendation.

It is especially useful for:

- Comparing electronics and computer parts
- Evaluating furniture and home products
- Comparing tools and hardware
- Researching automotive accessories
- Checking clothing, shoes, and accessories
- Comparing appliances
- Finding duplicate or rebranded marketplace products
- Verifying product specifications
- Preparing product lists for AI-assisted recommendations
- Saving product research as HTML or PDF for later review

## Summary

ShopScout is more than a simple shopping list extension. It is a product research and comparison assistant built into the browser.

It captures product data, extracts specifications, organizes products into lists, displays them in card and table views, supports saved HTML or PDF comparison pages, prepares structured AI prompts, applies category-aware quality analysis, supports manufacturer verification, and helps detect rebranded or duplicate products.

The result is a smarter shopping workflow. ShopScout helps users understand not only which product is cheaper, but which product is actually the better buy.
