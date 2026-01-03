# Test Data Seeding Instructions

For reliable test execution, the following test data is generated using Faker with a fixed seed (12345):

## Base Test Users (Generated with Faker):
- User ID 1: Erick Doyle (violet74@yahoo.com) - Engineering, Age: 25
- User ID 2: Ms. Eula Schroeder (ludie43@hotmail.com) - Marketing, Age: 40
- User ID 3: Mr. Ricardo Balistreri (jerad89@gmail.com) - Sales, Age: 36

## Valid Departments:
- Engineering
- Marketing
- Sales
- HR

## Test Data Features:
- **Realistic Data**: Generated using Faker.js for authentic names, emails, and ages
- **Consistent Results**: Fixed seed (12345) ensures reproducible test data across runs
- **Variety**: Each test run generates varied but valid data within constraints
- **Professional Quality**: Business-realistic names, properly formatted emails, valid ages

## File Upload Testing:

### Supported Image Formats:
- JPEG (.jpg, .jpeg)
- PNG (.png)
- GIF (.gif)
- WebP (.webp)

### File Upload Constraints:
- **Max file size**: 5MB per file
- **Max files per request**: 5 (for multi-file endpoints)
- **Required authentication**: All upload endpoints require JWT token

### Upload Endpoints:
| Endpoint | Field Name(s) | Description |
|----------|---------------|-------------|
| `POST /api/v1/uploads/image` | `image` | Single image upload |
| `POST /api/v1/uploads/images` | `images` | Multiple images (up to 5) |
| `POST /api/v1/uploads/profile` | `avatar`, `coverImage`, `gallery` + text fields | Mixed multipart form |
| `POST /api/v1/products/{id}/image` | `image` | Product image (manager/admin only) |

### Test Cases for File Uploads:
1. **Valid upload**: Upload supported image types
2. **Invalid file type**: Attempt to upload non-image files (expect 400)
3. **File too large**: Upload file >5MB (expect 400)
4. **Missing file**: Submit without file (expect 400)
5. **Too many files**: Upload >5 files at once (expect 400)
6. **Unauthorized access**: Try to view/delete another user's file (expect 403)
7. **Mixed form data**: Combine text fields with file uploads

### Sample Test Files:
For testing, you can create sample image files:
```bash
# Create a minimal valid JPEG (placeholder)
echo -n -e '\xFF\xD8\xFF\xE0\x00\x10JFIF\x00' > test-image.jpg

# Or use any valid image file from your system
```

## API Server Setup:
1. Ensure the demo API server is running on http://localhost:3000
2. Seed the database with the test users above (generated with Faker)
3. Configure department validation with the valid departments
4. Implement proper email uniqueness validation
5. Test data will be consistent across runs due to seeded Faker generation
6. The `uploads/` directory will be created automatically on first upload
