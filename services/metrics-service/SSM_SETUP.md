# SSM Metrics Setup Guide

The metrics-service uses **AWS Systems Manager (SSM) RunCommand** to collect real OS-level RAM and Disk usage from EC2 instances. This replaces the previous hardcoded placeholder values.

---

## 1. IAM Permissions for the Caller (metrics-service credentials)

The AWS credentials configured in `metrics-service/.env` need the following IAM permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ec2:DescribeInstances",
        "ssm:SendCommand",
        "ssm:GetCommandInvocation"
      ],
      "Resource": "*"
    }
  ]
}
```

---

## 2. IAM Role for the EC2 Instance

Each EC2 instance must have an **Instance Profile** with the `AmazonSSMManagedInstanceCore` managed policy attached. This allows the SSM Agent on the instance to communicate with the SSM service.

To attach it via AWS CLI:

```bash
aws iam attach-role-policy \
  --role-name <your-ec2-instance-role> \
  --policy-arn arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore
```

---

## 3. SSM Agent Availability

The SSM Agent comes **pre-installed** on:
- Amazon Linux 2 and Amazon Linux 2023
- Ubuntu 20.04+ (from AWS Marketplace AMIs)
- Windows Server 2016+ (all editions)

For other AMIs, install manually: https://docs.aws.amazon.com/systems-manager/latest/userguide/ssm-agent.html

---

## 4. Verify SSM Connectivity

Run this command to check which instances are SSM-managed in your region:

```bash
aws ssm describe-instance-information --region us-east-1
```

If an instance appears in the output, SSM commands can be sent to it.

---

## 5. Behavior When SSM is Unavailable

- If an instance is **not SSM-managed**, the collector logs a warning and stores `NULL` for RAM and Disk in the database. CPU is still collected from CloudWatch.
- If **no EC2 instances are running** (common in dev environments), the collector logs `"No running EC2 instances found"` and skips entirely. This is expected and not an error.
- The dashboard charts handle `NULL` values by rendering a gap in the line, and a small warning banner is displayed.
