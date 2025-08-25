# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Enhanced SQL metrics with 5 specific checks as specified in the plan
- Improved BRDR metrics for regulatory documents
- LLM-powered content generation command
- Column combination testing functionality
- Custom model integration (OpenAI-compatible APIs)
- Comprehensive test suite for metrics

### Changed
- Refactored CLI structure and commands
- Updated package dependencies for custom model support
- Enhanced error handling and validation

### Fixed
- Type comparison issues in CLI
- Module resolution for metrics
- SQL syntax validation logic

## [1.0.48] - 2025-01-27

### Added
- **LLM-Powered Content Generation**: New `generate-content` command for AI-powered database content generation
- **Column Combination Testing**: New `test-combinations` command to find optimal embedding setups
- **Enhanced SQL Metrics**: Implemented exactly 5 specific metrics as specified in the plan:
  - Table Exists (0 or 1)
  - Columns Same (0 or 1)
  - Same SQL Keywords (≥80% overlap = 1, <80% = 0)
  - Query Parsable (0 or 1)
  - No Syntax Errors (0 or 1)
- **Improved BRDR Metrics**: Enhanced banking regulation document retrieval metrics with specialized scoring
- **Custom Model Integration**: Support for OpenAI-compatible APIs (e.g., ModelScope) with environment variables:
  - `CUSTOM_API_KEY`
  - `CUSTOM_ENDPOINT`
  - `CUSTOM_MODEL`
- **Comprehensive Testing**: Unit tests for all metrics with 100% coverage of new functionality

### Changed
- **CLI Structure**: Refactored command structure for better organization and user experience
- **Package Dependencies**: Added new dependencies for enhanced functionality:
  - `openai` for OpenAI-compatible API support
  - `pg` for PostgreSQL database operations
  - `node-sql-parser` for SQL parsing and validation
  - `cosine-similarity` for similarity calculations
- **Metrics Implementation**: SQL metric now calculates overall score as average of the 5 specific metrics
- **Configuration**: Enhanced environment variable support for custom models

### Fixed
- **Type Safety**: Fixed boolean/string comparison issues in CLI
- **Module Resolution**: Resolved metrics import issues
- **SQL Validation**: Improved syntax error detection for unbalanced parentheses and quotes
- **Error Handling**: Enhanced error handling throughout the CLI

### Technical Details
- **SQL Metric**: Overall score = (tableExists + columnsSame + sameSqlKeywords + queryParsable + noSyntaxErrors) / 5
- **BRDR Metric**: Specialized for banking/regulatory docs with weighted scoring:
  - Keyword Match (30%)
  - Concept Match (25%)
  - Regulatory Compliance (25%)
  - Contextual Relevance (15%)
  - Semantic Accuracy (5%)
- **Custom Models**: Default provider set to 'custom' for OpenAI-compatible APIs
- **Column Combinations**: Power set generation for optimal embedding setup testing

## [1.0.45] - 2025-01-26

### Added
- Initial release with basic RAG testing functionality
- BRDR and SQL metrics (basic implementation)
- Database integration with Supabase/PostgreSQL
- Configuration management system
- Basic CLI interface

### Features
- Column combination testing
- Multiple embedding providers (local, OpenAI)
- Interactive configuration setup
- Test result export to JSON

## [1.0.0] - 2025-01-25

### Added
- Initial project setup
- Basic project structure
- TypeScript configuration
- Jest testing framework
- GitHub Actions workflows

---

## Migration Guide

### From v1.0.45 to v1.0.48

#### New Commands
```bash
# Generate content with AI models
rag-test generate-content --table users --columns description --based-on name,email

# Test column combinations
rag-test test-combinations --table documents --columns title,content,metadata --metric sql
```

#### Environment Variables
Add these to your `.env` file for custom model support:
```bash
CUSTOM_API_KEY=your-api-key
CUSTOM_ENDPOINT=https://your-api-endpoint/v1/chat/completions
CUSTOM_MODEL=your-model-name
```

#### Metrics Changes
- SQL metric now returns scores 0-1 for each of the 5 specific checks
- Overall SQL score is now the average of these 5 metrics
- BRDR metric has enhanced scoring for regulatory documents

### Breaking Changes
- None in this release

### Deprecated
- `populate-column` command is deprecated in favor of `generate-content`

---

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
