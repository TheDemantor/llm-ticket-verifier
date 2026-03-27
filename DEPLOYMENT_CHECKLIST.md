# DEPLOYMENT CHECKLIST

## Pre-Deployment

- [ ] All environment variables defined in .env.example and set in .env
- [ ] Database is accessible and credentials are correct
- [ ] LLM service (Ollama/DeepSeek) is configured and accessible
- [ ] Firewall rules allow necessary ports (3000 for backend, 8501 for frontend, 27017 for MongoDB)
- [ ] SSL/TLS certificates obtained (for HTTPS deployment)
- [ ] Backups of existing database created
- [ ] Team notified of deployment schedule

## Code Quality

- [ ] All tests pass (`npm test`)
- [ ] No hardcoded credentials in code
- [ ] Environment variables used for all configuration
- [ ] Error handling implemented
- [ ] Logging configured appropriately
- [ ] Code reviewed by team member

## Security Checklist

- [ ] CORS properly configured (frontend URL set)
- [ ] Authentication/Authorization implemented (if needed)
- [ ] Rate limiting enabled on API endpoints
- [ ] Database credentials secured (not in .env committed to git)
- [ ] HTTPS enabled in production
- [ ] Security headers configured
- [ ] Input validation on all API endpoints
- [ ] Dependencies updated and no known vulnerabilities
  ```bash
  npm audit
  pip audit
  ```

## Docker Deployment

- [ ] Docker images built successfully
  ```bash
  docker-compose build
  ```
- [ ] Images run correctly locally
  ```bash
  docker-compose up -d
  ```
- [ ] Container logs checked for errors
  ```bash
  docker-compose logs
  ```
- [ ] Health check endpoints respond correctly
- [ ] Images pushed to registry (if using remote registry)

## Database Deployment

- [ ] MongoDB instance created and running
- [ ] Database name matches DB_NAME environment variable
- [ ] Indexes created for better performance
- [ ] Connection string verified
- [ ] Backup and restore procedures tested
- [ ] Monitoring/alerting configured

## Application Deployment

- [ ] Backend starts without errors
  ```bash
  curl http://localhost:3000/health
  ```
- [ ] Frontend loads in browser
  ```
  http://localhost:8501
  ```
- [ ] Backend and frontend communicate correctly
- [ ] Chat functionality works end-to-end
- [ ] Database queries execute correctly
- [ ] LLM responses received correctly

## Monitoring & Logging

- [ ] Logging configured (stdout/file)
- [ ] Log rotation configured (if file-based)
- [ ] Monitoring dashboard set up
- [ ] Alerts configured for:
  - [ ] High error rates
  - [ ] Database connection failures
  - [ ] LLM service unavailable
  - [ ] Memory/CPU usage high
  - [ ] Disk space low
- [ ] Error tracking (Sentry/similar) configured

## Post-Deployment

- [ ] Verify backend health check responds: `curl https://api.yourdomain.com/health`
- [ ] Verify frontend loads: `https://yourdomain.com`
- [ ] Test core functionality in production:
  - [ ] Create new chat session
  - [ ] Submit problem description
  - [ ] Receive AI response
  - [ ] Complete a full conversation flow
- [ ] Check logs for errors
- [ ] Monitor resource usage
- [ ] Verify backups completed successfully

## Rollback Plan

- [ ] Previous version containers available
- [ ] Database rollback procedure documented
- [ ] Kubernetes/orchestration rollback procedures tested
- [ ] Rollback checklist:
  ```bash
  # Stop current deployment
  docker-compose down
  
  # Switch to previous version
  git checkout previous-version-tag
  
  # Rebuild and restart
  docker-compose build
  docker-compose up -d
  
  # Verify health
  curl http://localhost:3000/health
  ```

## Performance Baseline

- [ ] Response time benchmarks recorded
  - [ ] Backend average response time: ___ ms
  - [ ] Frontend page load time: ___ ms
  - [ ] LLM response time: ___ ms
- [ ] Database query performance checked
- [ ] Concurrent user load testing completed
- [ ] Resource usage under load documented

## Documentation

- [ ] Deployment guide updated
- [ ] Runbook created for common issues
- [ ] Team trained on deployment process
- [ ] Escalation procedures documented
- [ ] On-call rotation established

## Sign-Off

- **Deployed by**: __________________ Date: __________
- **Verified by**: __________________ Date: __________
- **Approved by**: __________________ Date: __________

## Notes

```
[Space for deployment notes and issues encountered]
```
