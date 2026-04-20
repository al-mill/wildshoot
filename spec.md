# Wild Shoot - Project Specification

## Overview

Wild Shoot is a DevOps-focused photo-sharing application that enables users to upload photos with location metadata while providing administrators with comprehensive analytics. Built entirely on AWS free tier services with emphasis on infrastructure automation, CI/CD practices, and scalable architecture.

## Requirements

### Functional Requirements

**User Features:**

- User authentication with profile pictures (AWS Cognito)
- Photo upload with location tagging and optional descriptions
- Photo preview before submission
- Responsive web interface

**Admin Features:**

- User analytics dashboard showing upload counts per user
- Location-based photo statistics and filtering
- Paginated photo gallery with administrative controls
- User management with photo count statistics

### Non-Functional Requirements

**DevOps & Infrastructure:**

- Infrastructure as Code using AWS CDK/CloudFormation
- Automated testing at multiple levels
  _Nice to Haves_
- Comprehensive monitoring and alerting
- Automated CI/CD pipeline with GitHub Actions
- Blue/green deployment capability

**Scale & Performance:**

- Support 10-10000 concurrent users within AWS free tier limits
- Image processing and optimization pipeline
- Database query optimization for analytics
