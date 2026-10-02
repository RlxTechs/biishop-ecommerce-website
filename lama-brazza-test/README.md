# Lama Brazza — test workspace

This branch is isolated from `main`.

The complete working test package was generated separately as a static e-commerce site (index.html + styles.css + app.js + Supabase schema). It is intentionally not merged into the existing Biishop storefront.

Target brand: **Lama Brazza**, Brazzaville subsidiary of **LamaShops**.

Core test features:
- product catalog and search
- cart persisted locally
- 10% quantity discount from 4 units of the same product
- delivery / pickup pricing
- Airtel Money and MTN MoMo payment instructions
- payment status kept pending until real verification
- demo customer login for testing
- Supabase schema prepared with RLS for production

The full test package is attached in the originating ChatGPT conversation and can be moved into a dedicated Lama Brazza repository before Vercel production deployment.
