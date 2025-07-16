# Contributing to WebAuthn Server Buildkit

First off, thank you for considering contributing to WebAuthn Server Buildkit! It's people like you that make this project better for everyone.

## Code of Conduct

By participating in this project, you are expected to uphold our standards of acceptable behavior. Please report unacceptable behavior to aoneahsan@gmail.com.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues as you might find out that you don't need to create one. When you are creating a bug report, please include as many details as possible:

- **Use a clear and descriptive title** for the issue to identify the problem.
- **Describe the exact steps which reproduce the problem** in as many details as possible.
- **Provide specific examples to demonstrate the steps**.
- **Describe the behavior you observed after following the steps** and point out what exactly is the problem with that behavior.
- **Explain which behavior you expected to see instead and why.**
- **Include details about your configuration and environment**

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, please include:

- **Use a clear and descriptive title** for the issue to identify the suggestion.
- **Provide a step-by-step description of the suggested enhancement** in as many details as possible.
- **Provide specific examples to demonstrate the steps**.
- **Describe the current behavior** and **explain which behavior you expected to see instead** and why.
- **Explain why this enhancement would be useful** to most users.

### Pull Requests

1. Fork the repo and create your branch from `main`.
2. If you've added code that should be tested, add tests.
3. If you've changed APIs, update the documentation.
4. Ensure the test suite passes.
5. Make sure your code lints.
6. Issue that pull request!

## Development Process

1. Clone the repository
   ```bash
   git clone https://github.com/aoneahsan/webauthn-server-buildkit.git
   cd webauthn-server-buildkit
   ```

2. Install dependencies
   ```bash
   yarn install
   ```

3. Run tests
   ```bash
   yarn test
   ```

4. Run linting
   ```bash
   yarn lint
   ```

5. Run type checking
   ```bash
   yarn typecheck
   ```

6. Build the project
   ```bash
   yarn build
   ```

## Styleguides

### Git Commit Messages

- Use the present tense ("Add feature" not "Added feature")
- Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
- Limit the first line to 72 characters or less
- Reference issues and pull requests liberally after the first line

### TypeScript Styleguide

- All TypeScript must adhere to the project's ESLint configuration
- Use TypeScript strict mode
- Prefer interfaces over type aliases for object types
- Document all exported functions and types with JSDoc comments
- Avoid `any` types; use `unknown` when the type is truly unknown

### Testing

- Write tests for all new functionality
- Maintain or improve code coverage
- Use descriptive test names that explain what is being tested
- Group related tests using `describe` blocks

## Additional Notes

### Issue and Pull Request Labels

- `bug`: Something isn't working
- `enhancement`: New feature or request
- `documentation`: Improvements or additions to documentation
- `good first issue`: Good for newcomers
- `help wanted`: Extra attention is needed

Thank you for contributing! 🎉