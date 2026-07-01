# ChessKidoo AI Admin

## Lint/Check Commands
- Lint JS: `npm run lint`
- Test: `npm test`
- Type-check functions: `Get-ChildItem supabase/functions/*.ts | % { npx tsc --noEmit --skipLibCheck $_.FullName }`