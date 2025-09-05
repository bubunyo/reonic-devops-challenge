# Reonic DevOps Challenge - Submission

## Infrastructure Design
Modular CDK architecture with separate constructs for each component:
- Network Stack: VPC with 3-tier architecture (public/private/isolated subnets)
    - public subnet: all public-facing infrastructure
    - private subnet: application infrastructure with egress capabilities
    - isolated subnet: all internal infrastructure with no internet access. e.g. databases 
- Database Stack: RDS PostgreSQL in isolated subnets with Secrets Manager integration
- Lambda Stack: Containerized Lambda with API Gateway integration
- GitHub Stack: OIDC provider for secure CI/CD authentication
- Image Repository: ECR repository for Lambda containers
- Least Privilege IAM: Scoped permissions with condition-based policies
- Network Isolation: Database in isolated subnets, Lambda in private subnets
- Secrets Management: AWS Secrets Manager for database credentials
- SSL/TLS: Encrypted database connections
- GitHub OIDC: Token-based authentication instead of long-lived access keys

### CI/CD
Dual-pipeline approach:
- CDK Pipeline: Deploys infrastructure changes (`deploy_cdk.yml`)
- Application Pipeline: Builds and deploys Lambda containers (`deploy_app.yml`)
- Separate App Lifecycle: Changes in different folders trigger respective deployment processes. This way changes in app folder don't trigger an infrastructure deploy
- Deployment Metrics: Push deployment metrics into CloudWatch 

This separation allows for independent infrastructure and application deployments.

## Setup Instructions 

### Prerequisites
- aws cli installed. More information: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html
- aws cdk installation. More Information: https://docs.aws.amazon.com/cdk/latest/guide/getting_started.html 

### Setup
1. Install all dependencies across both projects
```bash
npm run install:all
```

2. Configure AWS credentials. Take note of the created profile name after account configuration
```bash
aws configure
```
3. After initial AWS account configuration, authenticate your session. 
```bash
 aws sso login --profile <aws_sso_profile_name>
```

4. Deploy prerequisite infra to enable CI deployments
```bash
npm run bootstrap --profile=<aws_sso_profile_name>
```

5. Run synth, diff, and deploy with the command 
```bash
npm run synth --profile=<aws_sso_profile_name>
npm run cdk diff --profile=<aws_sso_profile_name>
npm run cdk deploy --profile=<aws_sso_profile_name>
```


## Deployment
The lambda is currently deployed to an api gateway with the following environment endpoints
dev: https://7cncrp0zz9.execute-api.eu-north-1.amazonaws.com
staging: https://9h9f4sm9q5.execute-api.eu-north-1.amazonaws.com

The lambda can be triggered with the following curl request.
```bash
curl -XPOST "<env-endpoint>/prod/2015-03-31/functions/function/invocations" -H "Content-Type: application/json" -d '{}'
```


### Local Development
```bash
# Build and test locally
npm run build
npm run test:compose

# Test Lambda endpoint
npm run test:lambda
```

### Deploy Infrastructure
```bash
# Deploy all CDK stacks
npm run deploy

# Or deploy individual components
cd cdk && npx cdk deploy GitHubStack
cd cdk && npx cdk deploy LambdaAppImageRepoStack
cd cdk && npx cdk deploy dev/MainVpcStack
```

### CI/CD Deployment
Push to `main` branch triggers automatic deployment:
1. CDK Stack: Deploys infrastructure changes
2. Lambda App: Builds container and updates function

### Testing the Solution
```bash
# Get API Gateway URL from CDK outputs
aws cloudformation describe-stacks --stack-name devLambdaStackC6933D02

# Test API endpoint
curl -X POST https://your-api-gateway-url/

# Check CloudWatch logs
aws logs tail /aws/lambda/dev__reonic-lambda-app --follow --profile=<aws_sso_profile_name>
aws logs tail /aws/lambda/staging__reonic-lambda-app --follow --profile=<aws_sso_profile_name>
```

## GitHub Actions Configuration

### Required Secrets
The following secrets must be configured in your GitHub repository settings:

- `AWS_GITHUB_ROLE_ARN` - ARN of the GitHub Actions IAM role for AWS authentication
- `SNS_TOPIC_ARN` - ARN of the SNS topic for deployment notifications

### Required Variables
The following variables should be configured:

- `AWS_REGION` - AWS region for deployments (e.g., `eu-north-1`)

To configure these:
1. Go to your GitHub repository settings
2. Navigate to Environments
3. Create a new Environement with name staging
4. Add the secrets under the "Environment Secrets" section
5. Add the variables under the "Environment Secrets" section

## Improvements 

- Enable proper SSL certificate validation with RDS CA bundle
- Implement branch-based GitHub OIDC restrictions
- Add WAF protection for API Gateway
- Enable VPC Flow Logs for network monitoring
- Multi-AZ Database Deployment: Deploy RDS in multiple availability zones
- Database Credentials Rotation: Enable automatic secret rotation in Secrets Manager
- Multi-Region Support: Implement cross-region deployments for disaster recovery
- Pipeline Orchestration: Use AWS CodePipeline for deployment coordination
- SHA-based Deployments: Inject commit SHA into Lambda for deployment verification
- Rollback Strategy: Implement automated rollback on deployment failures
- GitHub Actions Caching: Cache image builds and node modules to speed up builds
- Dedicated API Gateway: Use single gateway for multiple services and lambda
- Drift Detection: Add CloudFormation drift notifications
- Audit Trail: Implement change logs and audit trails
- Environment Isolation: Prevent staging/production deploys from local machines
- Enhanced Monitoring: Add custom CloudWatch dashboards
- Alerting: Implement comprehensive alarm strategy
- Distributed Tracing: Add AWS X-Ray integration
- Performance Metrics: Track Lambda cold starts, database connection pooling
- Separate Production/Staging Account: Separate account credentials for different environments
- GitHub Stack Separation: Move GitHub OIDC stack to prevent accidental deletion
- Shared Resources: Create separate stack for cross-environment resources
- Environment-Specific Configurations: Implement proper environment variable management
- Connection Pooling: Implement RDS Proxy for Lambda connections
- Read Replicas: Add read replicas for improved performance
- Backup Strategy: Implement point-in-time recovery and cross-region backups
- API Versioning: Implement proper API versioning strategy
- Rate Limiting: Add API throttling and quotas
