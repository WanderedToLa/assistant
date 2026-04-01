# CLAUDE.md — Global Rules

## Communication
- Always explain the logic in plain language before writing code
- Use Korean for all explanations and comments unless asked otherwise
- When something is unclear, ask before assuming
- Point out potential issues or risks proactively

## Code Style (TypeScript)
- All inline comments must be in Korean
- Function and variable names in English (camelCase)
- Every function must have a one-line JSDoc comment
- No magic numbers — use named constants or config variables
- Prefer async/await over promise chains
- Use strict TypeScript (strict: true in tsconfig)

## Python (수학/통계 모듈 한정)
- All inline comments in Korean
- Function and variable names in English (snake_case)
- Dependencies managed via requirements.txt

## Project Principles
- Prioritize readability over cleverness
- Keep each file focused on a single responsibility
- Never hardcode API keys — always use .env
- Always handle API errors explicitly, never silently pass
- Log meaningful messages so failures are easy to diagnose

## When Adding Features
- Preserve existing folder structure
- Confirm the approach before writing if the change touches core logic
- Add new functionality in a new file or clearly separated section

## Learning-First Approach
- This project is also a learning tool
- When introducing new concepts, briefly explain what it is and why
- Prefer simple and explicit over abstract and clever

## Environment
- Runtime: Node.js 20+
- Language: TypeScript
- Secrets: .env + dotenv
- Package manager: npm

## Git
- Commit messages in Korean, imperative form
  (예: "텔레그램 알림 모듈 추가", "급등 감지 쿨다운 버그 수정")
- Never commit .env
- .gitignore must include: .env, node_modules, dist