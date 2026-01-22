## API test checklist: /api/user/preferences

### Authorization
- Missing Authorization header returns 401.
- Authorization header without Bearer prefix returns 401.
- Invalid/expired Bearer token returns 401.

### GET /api/user/preferences
- Returns 200 with `data` when preferences exist.
- Returns 404 when no preferences exist for the user.

### POST /api/user/preferences
- Returns 201 with `data` on first creation.
- Returns 400 with `ALREADY_EXISTS` when preferences already exist.
- Returns 400 on invalid JSON body.
- Returns 400 on validation errors (missing fields or invalid types).

### PUT /api/user/preferences
- Returns 200 with `data` on insert when no preferences exist.
- Returns 200 with `data` on update when preferences exist.
- Returns 400 on invalid JSON body.
- Returns 400 on validation errors (missing fields or invalid types).

### Validation edges
- `allergens` and `exclusions` accept empty arrays.
- `diet` accepts null, but rejects empty string.
- `target_calories` and `target_servings` reject 0 and negatives.
