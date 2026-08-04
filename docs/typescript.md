# TypeScript Project

This project uses TypeScript with strict configuration.

## TypeScript Configuration
- Strict mode enabled
- No implicit any
- Strict null checks
- ES modules

## Type Conventions
- Prefer interfaces for object shapes
- Use type aliases for unions/intersections
- Export types alongside implementations
- Avoid `any` - use `unknown` if type is truly unknown

## Patterns
- Use discriminated unions for state
- Prefer readonly arrays and objects where applicable
- Use generics for reusable type-safe functions
- Leverage utility types (Partial, Required, Pick, Omit)

## Code Style
- Use explicit return types for exported functions
- Use const assertions for literal types
- Prefer nullish coalescing (??) over OR (||)
- Use optional chaining (?.) for safe property access

## File Organization
- One export per file when possible
- Co-locate types with implementations
- Use barrel exports (index.ts) for public APIs
