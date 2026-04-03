# Fix Duplicate Slug Error in Product Creation

## Steps (0/5 complete)

### 1. [x] Add `get_by_slug` method to ProductRepository in `backend/app/repositories/repositories.py`
### 2. [x] Update `create_product` in `backend/app/api/v1/endpoints/products.py` to check uniqueness and append suffix
### 3. [ ] Test duplicate slug creation via curl/Postman
### 4. [ ] Verify existing endpoints (list_products, get_product)
### 5. [ ] Restart server and final test

**Status**: Approved plan - starting implementation...

## Commands for testing:
```bash
# Test duplicate
curl -X POST http://localhost:8000/api/v1/products \\
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{\"name\":\"Tv\",\"price\":23,\"stock\":2,\"sku\":\"hr-2\",\"image_url\":\"https://example.com/tv.jpg\",\"description\":\"Test TV\"}'
```

