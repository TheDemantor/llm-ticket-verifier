# Kubernetes Deployment Configuration for DQMS

## Prerequisites

1. Kubernetes cluster (EKS, AKS, GKE, etc.)
2. kubectl configured
3. Docker images pushed to container registry
4. Persistent storage configured (for MongoDB)

## Directory Structure

```
kubernetes/
├── namespace.yaml
├── secrets.yaml
├── configmap.yaml
├── backend/
│   ├── deployment.yaml
│   ├── service.yaml
│   └── hpa.yaml
├── frontend/
│   ├── deployment.yaml
│   ├── service.yaml
│   └── hpa.yaml
├── database/
│   ├── statefulset.yaml
│   ├── service.yaml
│   └── pvc.yaml
└── ingress.yaml
```

## Quick Start

```bash
# Create namespace
kubectl apply -f kubernetes/namespace.yaml

# Create secrets (edit with your values first!)
kubectl apply -f kubernetes/secrets.yaml

# Create configmap
kubectl apply -f kubernetes/configmap.yaml

# Deploy database
kubectl apply -f kubernetes/database/

# Deploy backend
kubectl apply -f kubernetes/backend/

# Deploy frontend
kubectl apply -f kubernetes/frontend/

# Create ingress
kubectl apply -f kubernetes/ingress.yaml

# Check status
kubectl get pods -n dqms
kubectl get svc -n dqms
```

## Configuration Files

### 1. Namespace (kubernetes/namespace.yaml)
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: dqms
```

### 2. Secrets (kubernetes/secrets.yaml)
```bash
# Generate from .env
cat .env | kubectl create secret generic dqms-secrets -n dqms --from-env-file=-

# Or base64 encode and use secret manifest
kubectl apply -f kubernetes/secrets.yaml
```

### 3. ConfigMap (kubernetes/configmap.yaml)
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: dqms-config
  namespace: dqms
data:
  ENV: "production"
  LOG_LEVEL: "info"
```

### 4. Backend Deployment (kubernetes/backend/deployment.yaml)
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
  namespace: dqms
spec:
  replicas: 2
  selector:
    matchLabels:
      app: backend
  template:
    metadata:
      labels:
        app: backend
    spec:
      containers:
      - name: backend
        image: your-registry/dqms-backend:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        envFrom:
        - secretRef:
            name: dqms-secrets
        - configMapRef:
            name: dqms-config
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

### 5. Backend Service (kubernetes/backend/service.yaml)
```yaml
apiVersion: v1
kind: Service
metadata:
  name: backend
  namespace: dqms
spec:
  type: ClusterIP
  ports:
  - port: 3000
    targetPort: 3000
  selector:
    app: backend
```

### 6. Frontend Deployment (kubernetes/frontend/deployment.yaml)
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
  namespace: dqms
spec:
  replicas: 2
  selector:
    matchLabels:
      app: frontend
  template:
    metadata:
      labels:
        app: frontend
    spec:
      containers:
      - name: frontend
        image: your-registry/dqms-frontend:latest
        ports:
        - containerPort: 8501
        env:
        - name: STREAMLIT_SERVER_PORT
          value: "8501"
        - name: STREAMLIT_SERVER_ADDRESS
          value: "0.0.0.0"
        envFrom:
        - secretRef:
            name: dqms-secrets
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

### 7. Ingress (kubernetes/ingress.yaml)
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: dqms-ingress
  namespace: dqms
spec:
  ingressClassName: nginx
  rules:
  - host: your-domain.com
    http:
      paths:
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: backend
            port:
              number: 3000
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frontend
            port:
              number: 8501
```

## Management Commands

```bash
# View deployments
kubectl get deployments -n dqms

# View pods
kubectl get pods -n dqms

# View logs
kubectl logs -n dqms -l app=backend --tail=100 -f

# Scale deployment
kubectl scale deployment backend -n dqms --replicas=3

# Update image
kubectl set image deployment/backend backend=your-registry/dqms-backend:v2 -n dqms

# Rollback deployment
kubectl rollout undo deployment/backend -n dqms

# Check deployment status
kubectl rollout status deployment/backend -n dqms
```

## References

- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Kubectl Cheat Sheet](https://kubernetes.io/docs/reference/kubectl/cheatsheet/)
