The user CSV export is broken: spreadsheet apps split names like "Smith, Jane" into two columns,
notes that contain double quotes come out garbled, missing notes show as "undefined", the header
row does not match the columns we asked for, and our importer rejects the file because it needs
CRLF line endings. The existing tests pass. Fix src/ so the export follows the doc comments in
src/csv.ts and src/export.ts. Do not edit the tests.
