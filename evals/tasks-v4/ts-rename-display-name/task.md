Product has renamed the user field fullName to displayName. A colleague has already updated the
tests in test/ for the new name, so they fail now. Rename the field everywhere in src/ (model,
validation, API, storage, search and CSV export, where the column becomes display_name), with
these compatibility rules:

1. Stored records are now written as version 2 with displayName. Records already stored as
   version 1 with fullName must still load, as users with displayName.
2. For one release, API input to createUser may still send fullName instead of displayName.
   If both are sent, displayName wins.
3. Nothing the API, search or export returns contains fullName.

Do not edit the tests.
