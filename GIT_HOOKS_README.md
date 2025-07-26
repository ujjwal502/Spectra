# 🪝 Spectra Git Hooks Documentation

This document explains how to set up and use the Spectra pre-push Git hook for automated API testing and spec generation.

## 🎯 Overview

The Spectra pre-push hook automatically prompts you to run OpenAPI spec generation and intelligent testing workflows before pushing code. This ensures your API specifications and tests are always up-to-date.

## 🚀 Quick Setup

### Option 1: Automatic Setup (Recommended)

```bash
# Run the setup script from the Spectra project root
./setup-git-hooks.sh
```

### Option 2: Manual Setup

```bash
# Make sure you're in the Spectra project root
# The hook should already be created at .git/hooks/pre-push
chmod +x .git/hooks/pre-push
```

## 🔧 How It Works

### Workflow Trigger

The hook activates automatically when you run **any** Git push command:

```bash
git push                    # ✅ Hook activates
git push origin main        # ✅ Hook activates
git push -u origin feature  # ✅ Hook activates
git push --force            # ✅ Hook activates
```

### Interactive Workflow

When you push, the hook will:

1. **🔍 Environment Check**

   - Validates you're in the Spectra project root
   - Checks for required npm scripts
   - Verifies OpenAI API key (optional)

2. **📝 OpenAPI Spec Generation Prompt**

   ```
   🔍 Generate OpenAPI spec from demo-api source code? [y/N]:
   ```

   - **Yes**: Runs `npm run generate:spec:demo-api`
   - **No**: Skips to testing prompt

3. **🧠 Intelligent Testing Prompt**

   ```
   🧠 Run intelligent API testing workflow? [y/N]:
   ```

   - **Yes**:
     - Checks if demo API is running on localhost:8081
     - Runs `npm run test:demo-api:intelligent`
   - **No**: Skips testing

4. **🚀 Push Execution**
   - If all selected tasks succeed, the push proceeds
   - If any task fails, the push is aborted

## 📋 Prerequisites

### Required

- **Git repository**: Must be run from Spectra project root
- **Node.js & npm**: For running npm scripts
- **package.json**: With required Spectra scripts

### Optional (for full functionality)

- **OpenAI API Key**: Set `OPENAI_API_KEY` environment variable
- **Demo API Running**: Start with `cd examples/demo-api && mvn spring-boot:run`

## 🎮 Usage Examples

### Example 1: Full Workflow

```bash
$ git push origin main

🌟 ===== Spectra Pre-Push Hook =====

Spectra is about to help you ensure code quality before pushing!

✅ OpenAI API key found

🔍 Generate OpenAPI spec from demo-api source code? [y/N]: y

🚀 Running: npm run generate:spec:demo-api
Analyzing demo-api codebase and generating enhanced OpenAPI specification...

✅ Successfully completed: generate:spec:demo-api

🧠 Run intelligent API testing workflow? [y/N]: y

🔍 Checking if demo API is running on http://localhost:8081...
✅ Demo API is running and accessible

🚀 Running: npm run test:demo-api:intelligent
Executing comprehensive AI-powered API testing workflow...

✅ Successfully completed: test:demo-api:intelligent

🎉 Pre-push checks completed successfully!
🚀 Proceeding with git push...
```

### Example 2: Skip All (Quick Push)

```bash
$ git push

🌟 ===== Spectra Pre-Push Hook =====

🔍 Generate OpenAPI spec from demo-api source code? [y/N]: n
⏭️  Skipping OpenAPI spec generation

🧠 Run intelligent API testing workflow anyway? [y/N]: n
⏭️  Skipping intelligent testing

🎉 Pre-push checks completed successfully!
🚀 Proceeding with git push...
```

### Example 3: Testing Only

```bash
$ git push

🔍 Generate OpenAPI spec from demo-api source code? [y/N]: n
⏭️  Skipping OpenAPI spec generation

🧠 Run intelligent API testing workflow anyway? [y/N]: y

⚠️  Demo API is not running on http://localhost:8081
   This is required for intelligent testing to work properly

To start the demo API:
  cd examples/demo-api
  mvn spring-boot:run

Continue anyway? (Testing may fail) [y/N]: y
```

## ⚙️ Configuration Options

### Environment Variables

```bash
# Required for AI features
export OPENAI_API_KEY="your-openai-api-key-here"

# Optional: Specify OpenAI model
export OPENAI_MODEL="gpt-4"

# Optional: Set timeout for OpenAI requests
export OPENAI_TIMEOUT="30000"
```

### Demo API Setup

```bash
# Terminal 1: Start demo API
cd examples/demo-api
mvn spring-boot:run

# Terminal 2: Verify it's running
curl http://localhost:8081/api/v1/users
```

## 🛠️ Troubleshooting

### Common Issues

#### 1. "Permission denied" error

```bash
# Fix: Make the hook executable
chmod +x .git/hooks/pre-push
```

#### 2. "package.json not found"

```bash
# Fix: Run from Spectra project root
cd /path/to/Spectra
git push
```

#### 3. "OpenAI API key not set"

```bash
# Fix: Set environment variable
export OPENAI_API_KEY="your-key-here"
# Or continue without AI features when prompted
```

#### 4. "Demo API not running"

```bash
# Fix: Start demo API in another terminal
cd examples/demo-api
mvn spring-boot:run
```

#### 5. npm script fails

```bash
# Check script exists
npm run --silent | grep generate:spec:demo-api
npm run --silent | grep test:demo-api:intelligent

# Run manually to debug
npm run generate:spec:demo-api
npm run test:demo-api:intelligent
```

### Bypass Hook (Emergency)

```bash
# Skip the hook completely if needed
git push --no-verify

# Or temporarily disable
mv .git/hooks/pre-push .git/hooks/pre-push.disabled
git push
mv .git/hooks/pre-push.disabled .git/hooks/pre-push
```

## 🔧 Advanced Configuration

### Customize Hook Behavior

Edit `.git/hooks/pre-push` to:

1. **Change default responses**

   ```bash
   # Change from [y/N] to [Y/n] for default "yes"
   "" ) return 0;;  # Default to Yes instead
   ```

2. **Add additional checks**

   ```bash
   # Add linting before spec generation
   if ask_yes_no "🔍 Run linting first?"; then
       npm run lint
   fi
   ```

3. **Modify script order**
   ```bash
   # Always run linting, then ask about spec generation
   npm run lint
   if ask_yes_no "🔍 Generate OpenAPI spec?"; then
       # ... rest of workflow
   ```

### Hook Management Scripts

#### Disable Hook

```bash
mv .git/hooks/pre-push .git/hooks/pre-push.disabled
echo "✅ Pre-push hook disabled"
```

#### Enable Hook

```bash
mv .git/hooks/pre-push.disabled .git/hooks/pre-push
chmod +x .git/hooks/pre-push
echo "✅ Pre-push hook enabled"
```

#### Reinstall Hook

```bash
./setup-git-hooks.sh
```

## 📊 Benefits

### For Development

- ✅ **Automated Quality Gates**: Ensures specs and tests are current
- ✅ **Consistent Workflow**: Same process for all team members
- ✅ **Early Issue Detection**: Catches problems before code reaches remote
- ✅ **Documentation Sync**: API specs stay aligned with code changes

### For Teams

- ✅ **Standardized Process**: Everyone follows same pre-push workflow
- ✅ **Reduced CI Failures**: Issues caught locally before CI/CD
- ✅ **Better Code Quality**: Encourages testing and documentation
- ✅ **Faster Feedback**: Immediate results vs waiting for CI

## 🎯 Best Practices

### Daily Workflow

1. **Make your code changes**
2. **Commit your changes** (`git commit`)
3. **Push with confidence** (`git push`) - let the hook handle quality checks
4. **Review generated artifacts** (OpenAPI specs, test reports)

### Team Setup

1. **Share setup script**: Include `setup-git-hooks.sh` in your project
2. **Document environment**: Ensure team knows about `OPENAI_API_KEY`
3. **Demo API coordination**: Consider shared demo API instance
4. **Hook customization**: Adapt hook behavior to team preferences

### CI/CD Integration

```yaml
# Example GitHub Actions integration
- name: Setup Git Hooks
  run: ./setup-git-hooks.sh

- name: Validate with same tools
  run: |
    npm run generate:spec:demo-api
    npm run test:demo-api:intelligent
```

## 🔮 Next Steps

- **Extend to other hooks**: Add pre-commit, post-merge hooks
- **Custom scripts**: Add your own project-specific validations
- **Team integration**: Share and standardize across your team
- **CI/CD alignment**: Use same tools in your build pipeline

---

## 🆘 Support

If you encounter issues:

1. **Check prerequisites** (Node.js, Git, OpenAI key)
2. **Verify file permissions** (`chmod +x .git/hooks/pre-push`)
3. **Run setup script again** (`./setup-git-hooks.sh`)
4. **Test manually** (run npm scripts directly)
5. **Use bypass if urgent** (`git push --no-verify`)

The hook is designed to be helpful, not obstructive. When in doubt, you can always skip checks and run them manually later!
