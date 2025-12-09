import React from 'react';
import { 
  Monitor, Server, Database, HardDrive, Globe, Shield, Activity, 
  Layers, Box, MessageSquare, Webhook, 
  Clock, PlayCircle, StopCircle, Repeat, Layout, 
  Cpu, GitBranch, ArrowRightLeft, Square,
  Wifi, Scale, Settings, FileCheck, Share2, Archive, Lock, Zap
} from 'lucide-react';
import { ComponentType, ComponentDefinition } from './types';

// Helper to get icon
export const getIconForType = (type: ComponentType) => {
  const spec = COMPONENT_SPECS[type];
  return spec ? spec.icon : <Box size={20} />;
};

export const COMPONENT_SPECS: Record<string, ComponentDefinition> = {
  // 1. Clients & Entry Layer
  [ComponentType.CLIENT_ENTRY]: {
    type: ComponentType.CLIENT_ENTRY,
    label: '1. Clients & Entry',
    icon: <Monitor size={20} />,
    description: 'How requests enter the system.',
    subTypes: [
      // 1.1 Client Types
      { id: 'client_web', category: '1.1 Client Types', label: 'Web Application', description: 'Browser-based client.', tools: ['React', 'Next.js', 'Vue', 'Angular'] },
      { id: 'client_mobile', category: '1.1 Client Types', label: 'Mobile Application', description: 'Native or cross-platform mobile app.', tools: ['iOS Swift', 'Android Kotlin', 'Flutter', 'React Native'] },
      { id: 'client_iot', category: '1.1 Client Types', label: 'IoT Device', description: 'Connected hardware device.', tools: ['Arduino', 'Raspberry Pi', 'Embedded C'] },
      { id: 'client_internal', category: '1.1 Client Types', label: 'Internal Service', description: 'Service-to-service call.', tools: ['Microservice Client', 'CLI Tool'] },
      { id: 'client_partner', category: '1.1 Client Types', label: 'External Partner', description: 'Third-party integration.', tools: ['Webhook', 'Partner API'] },
      
      // 1.2 Entry Points
      { id: 'entry_api', category: '1.2 Entry Points', label: 'API Endpoint', description: 'Standard HTTP/REST entry.', tools: ['REST Controller', 'FastAPI', 'Express'] },
      { id: 'entry_web', category: '1.2 Entry Points', label: 'Web Endpoint', description: 'HTML serving endpoint.', tools: ['Nginx Serve', 'Apache'] },
      { id: 'entry_event', category: '1.2 Entry Points', label: 'Event Endpoint', description: 'Async ingress.', tools: ['Webhook Receiver', 'SQS Ingress'] },
      { id: 'entry_graph', category: '1.2 Entry Points', label: 'Graph Endpoint', description: 'GraphQL entry.', tools: ['Apollo Server', 'Hasura'] },
      { id: 'entry_binary', category: '1.2 Entry Points', label: 'Binary Endpoint', description: 'gRPC or Thrift.', tools: ['gRPC Service', 'Protobuf'] },

      // 1.3 Access Mediation
      { id: 'routing', category: '1.3 Access Mediation', label: 'Request Routing', description: 'Path-based routing.', tools: ['Ingress Controller', 'Route53'] },
      { id: 'versioning', category: '1.3 Access Mediation', label: 'API Versioning', description: 'Version control strategy.', tools: ['Header Versioning', 'URI Versioning'] },
      { id: 'auth_enforce', category: '1.3 Access Mediation', label: 'Auth Enforcement', description: 'Identity check.', tools: ['JWT Middleware', 'OIDC Proxy'] },
    ]
  },

  // 2. Traffic Management Layer
  [ComponentType.TRAFFIC]: {
    type: ComponentType.TRAFFIC,
    label: '2. Traffic Mgmt',
    icon: <Globe size={20} />,
    description: 'Controlling flow: balancing, shaping, routing.',
    subTypes: [
      // 2.1 Load Distribution
      { id: 'load_balancer', category: '2.1 Load Distribution', label: 'Load Balancer', description: 'L4/L7 Distribution.', tools: ['Nginx', 'HAProxy', 'AWS ALB', 'Google GLB'] },
      { id: 'reverse_proxy', category: '2.1 Load Distribution', label: 'Reverse Proxy', description: 'Gateway proxy.', tools: ['Traefik', 'Envoy', 'Nginx'] },
      { id: 'multiplex', category: '2.1 Load Distribution', label: 'Request Multiplexing', description: 'Connection reuse.', tools: ['HTTP/2', 'Quic'] },
      
      // 2.2 Traffic Shaping
      { id: 'rate_limiter', category: '2.2 Traffic Shaping', label: 'Rate Limiting', description: 'Prevent abuse.', tools: ['Redis Rate Limiter', 'Token Bucket'] },
      { id: 'throttling', category: '2.2 Traffic Shaping', label: 'Throttling', description: 'Slow down traffic.', tools: ['API Gateway Policy'] },
      { id: 'quotas', category: '2.2 Traffic Shaping', label: 'Quotas', description: 'Usage caps.', tools: ['Usage Plan'] },
      
      // 2.3 Edge Handling
      { id: 'edge_compute', category: '2.3 Edge Handling', label: 'Edge Compute', description: 'Logic at edge.', tools: ['Cloudflare Workers', 'Lambda@Edge'] },
      { id: 'edge_sec', category: '2.3 Edge Handling', label: 'Edge Security', description: 'WAF at edge.', tools: ['AWS WAF', 'Akamai Kona'] }
    ]
  },

  // 3. Application / Compute Layer
  [ComponentType.COMPUTE]: {
    type: ComponentType.COMPUTE,
    label: '3. Compute & App',
    icon: <Cpu size={20} />,
    description: 'Executes business logic.',
    subTypes: [
      // 3.1 Compute Models
      { id: 'monolith', category: '3.1 Compute Models', label: 'Monolithic Service', description: 'Single unit.', tools: ['Rails App', 'Django App', 'Spring Monolith'] },
      { id: 'microservice', category: '3.1 Compute Models', label: 'Microservice', description: 'Decoupled service.', tools: ['Go Service', 'Node Service', 'Python Service'] },
      { id: 'serverless', category: '3.1 Compute Models', label: 'Serverless Function', description: 'FaaS.', tools: ['AWS Lambda', 'Azure Functions', 'Google Cloud Functions'] },
      { id: 'batch', category: '3.1 Compute Models', label: 'Batch Worker', description: 'Async processing.', tools: ['Spring Batch', 'Celery Worker'] },
      { id: 'stream_proc', category: '3.1 Compute Models', label: 'Stream Processor', description: 'Real-time ETL.', tools: ['Spark Streaming', 'Flink', 'Kafka Streams'] },
      
      // 3.2 Processing Concepts
      { id: 'stateless', category: '3.2 Processing Concepts', label: 'Stateless Proc', description: 'No local state.', tools: ['12-Factor App'] },
      { id: 'stateful', category: '3.2 Processing Concepts', label: 'Stateful Proc', description: 'Maintains state.', tools: ['Actor Model (Akka)', 'Game Server'] },
      
      // 3.3 Business Logic
      { id: 'validation', category: '3.3 Business Logic', label: 'Validation', description: 'Input checking.', tools: ['Zod', 'Joi', 'Bean Validation'] },
      { id: 'orchestrator', category: '3.3 Business Logic', label: 'Orchestration', description: 'Coordination.', tools: ['Temporal', 'Step Functions', 'Airflow'] }
    ]
  },

  // 4. Data Storage Layer
  [ComponentType.DATABASE]: {
    type: ComponentType.DATABASE,
    label: '4. Data Storage',
    icon: <Database size={20} />,
    description: 'Stores structured & semi-structured data.',
    subTypes: [
      // 4.1 Data Models
      { id: 'rdbms', category: '4.1 Data Models', label: 'Relational (SQL)', description: 'Tabular data.', tools: ['PostgreSQL', 'MySQL', 'Aurora', 'SQL Server', 'Oracle'] },
      { id: 'document', category: '4.1 Data Models', label: 'Document Store', description: 'JSON/BSON.', tools: ['MongoDB', 'DocumentDB', 'Couchbase'] },
      { id: 'kv', category: '4.1 Data Models', label: 'Key-Value', description: 'Simple lookup.', tools: ['Redis', 'DynamoDB', 'Riak'] },
      { id: 'wide_col', category: '4.1 Data Models', label: 'Wide-Column', description: 'Scalable rows.', tools: ['Cassandra', 'HBase', 'ScyllaDB'] },
      { id: 'graph', category: '4.1 Data Models', label: 'Graph DB', description: 'Relationships.', tools: ['Neo4j', 'Neptune', 'JanusGraph'] },
      { id: 'timeseries', category: '4.1 Data Models', label: 'Time-Series', description: 'Time-stamped.', tools: ['InfluxDB', 'TimescaleDB'] },
      { id: 'vector', category: '4.1 Data Models', label: 'Vector DB', description: 'Embeddings.', tools: ['Pinecone', 'Milvus', 'Weaviate'] },

      // 4.2 Data Management
      { id: 'sharding', category: '4.2 Data Management', label: 'Sharding', description: 'Horizontal partition.', tools: ['Vitess', 'Citus'] },
      { id: 'replication', category: '4.2 Data Management', label: 'Replication', description: 'Redundancy.', tools: ['Multi-AZ', 'Read Replica'] }
    ]
  },

  // 5. Caching Layer
  [ComponentType.CACHE]: {
    type: ComponentType.CACHE,
    label: '5. Caching',
    icon: <Zap size={20} />,
    description: 'Accelerates data access.',
    subTypes: [
      // 5.1 Cache Placement
      { id: 'local_cache', category: '5.1 Cache Placement', label: 'Application-local', description: 'In-memory.', tools: ['Guava', 'Caffeine', 'Ehcache'] },
      { id: 'dist_cache', category: '5.1 Cache Placement', label: 'Distributed Cache', description: 'Shared cluster.', tools: ['Redis', 'Memcached', 'Hazelcast'] },
      { id: 'edge_cache', category: '5.1 Cache Placement', label: 'Edge Cache', description: 'CDN based.', tools: ['Cloudflare Cache', 'CloudFront'] },
      
      // 5.2 Cache Strategies
      { id: 'cache_aside', category: '5.2 Cache Strategies', label: 'Cache-Aside', description: 'Lazy loading.', tools: ['Logic Pattern'] },
      { id: 'write_through', category: '5.2 Cache Strategies', label: 'Write-Through', description: 'Sync write.', tools: ['Logic Pattern'] }
    ]
  },

  // 6. Messaging & Streaming Layer
  [ComponentType.MESSAGING]: {
    type: ComponentType.MESSAGING,
    label: '6. Messaging',
    icon: <MessageSquare size={20} />,
    description: 'Async and event-driven communication.',
    subTypes: [
      // 6.1 Messaging Types
      { id: 'queue', category: '6.1 Messaging Types', label: 'Queue', description: 'Point-to-point.', tools: ['RabbitMQ', 'Amazon SQS', 'ActiveMQ'] },
      { id: 'topic', category: '6.1 Messaging Types', label: 'Topic / PubSub', description: 'Broadcasting.', tools: ['Amazon SNS', 'Google Pub/Sub'] },
      { id: 'stream', category: '6.1 Messaging Types', label: 'Stream', description: 'Log-based.', tools: ['Apache Kafka', 'Amazon Kinesis', 'Redpanda'] },
      { id: 'event_bus', category: '6.1 Messaging Types', label: 'Event Bus', description: 'Router.', tools: ['EventBridge', 'Azure Event Grid'] },

      // 6.2 Workflow
      { id: 'saga', category: '6.2 Workflow Models', label: 'Saga Pattern', description: 'Distributed transaction.', tools: ['Orchestrator', 'Choreography'] },
      { id: 'event_sourcing', category: '6.2 Workflow Models', label: 'Event Sourcing', description: 'State as events.', tools: ['Axon', 'EventStore'] }
    ]
  },

  // 7. File & Blob Storage Layer
  [ComponentType.FILE_STORAGE]: {
    type: ComponentType.FILE_STORAGE,
    label: '7. File & Blob',
    icon: <HardDrive size={20} />,
    description: 'Unstructured large binary data.',
    subTypes: [
      // 7.1 Blob Types
      { id: 'media', category: '7.1 Blob Types', label: 'Media Files', description: 'Images/Video.', tools: ['S3 Standard', 'GCS Standard'] },
      { id: 'archives', category: '7.1 Blob Types', label: 'Archives', description: 'Cold storage.', tools: ['Glacier', 'GCS Coldline'] },
      { id: 'logs_blob', category: '7.1 Blob Types', label: 'Logs Storage', description: 'Audit trails.', tools: ['S3 Infrequent Access'] }
    ]
  },

  // 8. Content Delivery Layer
  [ComponentType.CDN]: {
    type: ComponentType.CDN,
    label: '8. CDN',
    icon: <Share2 size={20} />,
    description: 'Accelerates global access.',
    subTypes: [
      // 8.1 Content Types
      { id: 'static_cdn', category: '8.1 Content Types', label: 'Static Assets', description: 'JS/CSS/Images.', tools: ['CloudFront', 'Akamai', 'Fastly'] },
      { id: 'dynamic_cdn', category: '8.1 Content Types', label: 'API Acceleration', description: 'Dynamic routing.', tools: ['Cloudflare', 'AWS Global Accelerator'] },
      
      // 8.2 Features
      { id: 'geo_route', category: '8.2 Features', label: 'Geo-Routing', description: 'DNS based.', tools: ['Route53', 'NS1'] }
    ]
  },

  // 9. Observability & Telemetry Layer
  [ComponentType.OBSERVABILITY]: {
    type: ComponentType.OBSERVABILITY,
    label: '9. Observability',
    icon: <Activity size={20} />,
    description: 'Monitors system behavior.',
    subTypes: [
      // 9.1 Logging
      { id: 'log_agg', category: '9.1 Logging', label: 'Structured Logs', description: 'Central logging.', tools: ['ELK Stack', 'Splunk', 'Fluentd'] },
      // 9.2 Metrics
      { id: 'metrics', category: '9.2 Metrics', label: 'System Metrics', description: 'Time-series.', tools: ['Prometheus', 'Datadog', 'CloudWatch'] },
      // 9.3 Tracing
      { id: 'tracing', category: '9.3 Tracing', label: 'Distributed Tracing', description: 'Request flow.', tools: ['Jaeger', 'Zipkin', 'OpenTelemetry'] },
      // 9.4 Alerting
      { id: 'alerts', category: '9.4 Alerting', label: 'Alerting', description: 'Notifications.', tools: ['PagerDuty', 'OpsGenie'] }
    ]
  },

  // 10. Security Layer
  [ComponentType.SECURITY]: {
    type: ComponentType.SECURITY,
    label: '10. Security',
    icon: <Shield size={20} />,
    description: 'Confidentiality, integrity, access.',
    subTypes: [
      // 10.1 Identity
      { id: 'idp', category: '10.1 Identity & Access', label: 'Identity Provider', description: 'AuthN/AuthZ.', tools: ['Auth0', 'Okta', 'Cognito', 'Keycloak'] },
      { id: 'iam', category: '10.1 Identity & Access', label: 'IAM', description: 'Role access.', tools: ['AWS IAM', 'RBAC System'] },
      // 10.2 Transport
      { id: 'mtls', category: '10.2 Transport Security', label: 'mTLS', description: 'Mutual TLS.', tools: ['Istio', 'Consul Connect'] },
      // 10.3 App Sec
      { id: 'secrets', category: '10.3 App Security', label: 'Secrets Mgmt', description: 'Keys & Passwords.', tools: ['HashiCorp Vault', 'AWS Secrets Manager'] },
      // 10.4 Threat
      { id: 'ddos', category: '10.4 Threat Mitigation', label: 'DDoS Protection', description: 'Shield.', tools: ['AWS Shield', 'Cloudflare'] }
    ]
  },

  // 11. Reliability
  [ComponentType.RELIABILITY]: {
    type: ComponentType.RELIABILITY,
    label: '11. Reliability',
    icon: <Wifi size={20} />,
    description: 'Durability and uptime.',
    subTypes: [
      // 11.1 Redundancy
      { id: 'multi_zone', category: '11.1 Redundancy', label: 'Multi-Zone', description: 'HA.', tools: ['Availability Zones'] },
      { id: 'multi_region', category: '11.1 Redundancy', label: 'Multi-Region', description: 'DR.', tools: ['Global Replication'] },
      // 11.2 Self-Healing
      { id: 'circuit_breaker', category: '11.2 Self-Healing', label: 'Circuit Breaker', description: 'Fail fast.', tools: ['Resilience4j', 'Hystrix'] },
      { id: 'health_check', category: '11.2 Self-Healing', label: 'Health Check', description: 'Liveness probe.', tools: ['K8s Probes', 'LB Health Check'] }
    ]
  },

  // 12. Scalability
  [ComponentType.SCALABILITY]: {
    type: ComponentType.SCALABILITY,
    label: '12. Scalability',
    icon: <Scale size={20} />,
    description: 'Allows the system to grow.',
    subTypes: [
      // 12.1 Scaling Models
      { id: 'hpa', category: '12.1 Scaling Models', label: 'Horizontal Scaling', description: 'More instances.', tools: ['K8s HPA', 'ASG'] },
      { id: 'vpa', category: '12.1 Scaling Models', label: 'Vertical Scaling', description: 'Bigger instances.', tools: ['Instance Resize'] },
      // 12.2 Performance
      { id: 'load_shed', category: '12.2 Performance', label: 'Load Shedding', description: 'Drop excess.', tools: ['Interceptor'] }
    ]
  },

  // 13. Data Governance
  [ComponentType.DATA_GOV]: {
    type: ComponentType.DATA_GOV,
    label: '13. Data Gov',
    icon: <Archive size={20} />,
    description: 'Quality, privacy, retention.',
    subTypes: [
      // 13.1 Lifecycle
      { id: 'archival', category: '13.1 Data Lifecycle', label: 'Archival Policy', description: 'Move to cold.', tools: ['Lifecycle Rules'] },
      { id: 'deletion', category: '13.1 Data Lifecycle', label: 'Deletion / TTL', description: 'Expire data.', tools: ['TTL Index'] },
      // 13.2 Control
      { id: 'access_policy', category: '13.2 Data Control', label: 'Access Policy', description: 'Who sees what.', tools: ['Data Masking', 'Tokenization'] }
    ]
  },

  // 14. DevOps
  [ComponentType.DEVOPS]: {
    type: ComponentType.DEVOPS,
    label: '14. DevOps',
    icon: <Server size={20} />,
    description: 'Build and delivery.',
    subTypes: [
      // 14.1 Deployment
      { id: 'blue_green', category: '14.1 Deployment', label: 'Blue-Green', description: 'Zero downtime.', tools: ['Spinnaker', 'Argo Rollouts'] },
      { id: 'canary', category: '14.1 Deployment', label: 'Canary', description: 'Gradual rollout.', tools: ['Istio', 'Flag'] },
      // 14.2 Packaging
      { id: 'docker', category: '14.2 Packaging', label: 'Containerization', description: 'Images.', tools: ['Docker', 'Podman'] },
      { id: 'ci', category: '14.2 Packaging', label: 'CI Pipeline', description: 'Build/Test.', tools: ['Jenkins', 'GitHub Actions'] },
      // 14.3 Runtime
      { id: 'k8s', category: '14.3 Runtime', label: 'Orchestrator', description: 'Manage containers.', tools: ['Kubernetes', 'Nomad', 'ECS'] }
    ]
  },

  // 15. Config
  [ComponentType.CONFIG]: {
    type: ComponentType.CONFIG,
    label: '15. Config',
    icon: <Settings size={20} />,
    description: 'Consistent operation.',
    subTypes: [
      // 15.1 Configuration
      { id: 'env_config', category: '15.1 Configuration', label: 'Env Config', description: 'Environment vars.', tools: ['Dotenv', 'ConfigMap'] },
      { id: 'dynamic_conf', category: '15.1 Configuration', label: 'Dynamic Config', description: 'Hot reload.', tools: ['Consul', 'Etcd', 'ZooKeeper'] },
      // 15.2 State
      { id: 'state_store', category: '15.2 State', label: 'External State', description: 'Redis for Session.', tools: ['Redis'] }
    ]
  },

  // 16. Governance
  [ComponentType.GOVERNANCE]: {
    type: ComponentType.GOVERNANCE,
    label: '16. Governance',
    icon: <FileCheck size={20} />,
    description: 'Compliance & Risk.',
    subTypes: [
      // 16.1 Governance
      { id: 'decision_log', category: '16.1 Governance', label: 'ADR Log', description: 'Architecture records.', tools: ['Markdown', 'Wiki'] },
      // 16.2 Compliance
      { id: 'audit', category: '16.2 Compliance', label: 'Audit Trail', description: 'Legal log.', tools: ['CloudTrail'] },
      // 16.3 Risk
      { id: 'incident', category: '16.3 Risk', label: 'Incident Response', description: 'Ops process.', tools: ['Runbook'] }
    ]
  },

  // FLOW & STRUCTURE (Preserved)
  [ComponentType.FLOW_START]: { type: ComponentType.FLOW_START, label: 'Start', icon: <PlayCircle size={20} />, description: 'Start of flow.', subTypes: [] },
  [ComponentType.FLOW_END]: { type: ComponentType.FLOW_END, label: 'End', icon: <StopCircle size={20} />, description: 'End of flow.', subTypes: [] },
  [ComponentType.FLOW_PROCESS]: { type: ComponentType.FLOW_PROCESS, label: 'Process', icon: <Square size={20} />, description: 'Action step.', subTypes: [] },
  [ComponentType.FLOW_DECISION]: { type: ComponentType.FLOW_DECISION, label: 'Decision', icon: <GitBranch size={20} />, description: 'Branching logic.', subTypes: [] },
  [ComponentType.FLOW_DATA]: { type: ComponentType.FLOW_DATA, label: 'Data I/O', icon: <ArrowRightLeft size={20} />, description: 'Input/Output.', subTypes: [] },
  [ComponentType.FLOW_LOOP]: { type: ComponentType.FLOW_LOOP, label: 'Loop', icon: <Repeat size={20} />, description: 'Iteration.', subTypes: [] },
  [ComponentType.FLOW_TIMER]: { type: ComponentType.FLOW_TIMER, label: 'Timer', icon: <Clock size={20} />, description: 'Schedule.', subTypes: [] },
  [ComponentType.FLOW_EVENT]: { type: ComponentType.FLOW_EVENT, label: 'Event', icon: <Webhook size={20} />, description: 'Trigger.', subTypes: [] },
  [ComponentType.STRUCTURE_LAYER]: { type: ComponentType.STRUCTURE_LAYER, label: 'Zone / Layer', icon: <Layout size={20} />, description: 'Logical grouping.', subTypes: [] },
  [ComponentType.CUSTOM]: { type: ComponentType.CUSTOM, label: 'Custom Tool', icon: <Box size={20} />, description: 'Custom component.', subTypes: [] }
};