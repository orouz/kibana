/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

export type { Formats } from './formats';
export { formats } from './formats';
export * from './i18n';
export * from './pseudo_locale';

export const common = {
  Cancel: 'Cancel',
  Name: 'Name',
  Delete: 'Delete',
  Close: 'Close',
  Actions: 'Actions',
  Type: 'Type',
  Description: 'Description',
  Edit: 'Edit',
  Save: 'Save',
  Status: 'Status',
  Settings: 'Settings',
  Field: 'Field',
  Overview: 'Overview',
  Discover: 'Discover',
  Value: 'Value',
  Metric: 'Metric',
  Version: 'Version',
  Error: 'Error',
  Metrics: 'Metrics',
  Create: 'Create',
  Refresh: 'Refresh',
  None: 'None',
  Alerts: 'Alerts',
  URL: 'URL',
  value: 'value',
  Add: 'Add',
  Count: 'Count',
  Remove: 'Remove',
  Data: 'Data',
  Unknown: 'Unknown',
  ID: 'ID',
  Label: 'Label',
  Query: 'Query',
  Tags: 'Tags',
  Aggregation: 'Aggregation',
  Search: 'Search',
  Apply: 'Apply',
  Title: 'Title',
  Filter: 'Filter',
  Max: 'Max',
  Indices: 'Indices',
  Summary: 'Summary',
  Update: 'Update',
  Average: 'Average',
  Warning: 'Warning',
  Yes: 'Yes',
  No: 'No',
  All: 'All',
  Options: 'Options',
  Beta: 'Beta',
  Back: 'Back',
  Reset: 'Reset',
  Logs: 'Logs',
  Details: 'Details',
  Events: 'Events',
  Documentation: 'Documentation',
  Preview: 'Preview',
  Min: 'Min',
  Index: 'Index',
  Manage: 'Manage',
  Total: 'Total',
  Hosts: 'Hosts',
  Observability: 'Observability',
  Dismiss: 'Dismiss',
  Sum: 'Sum',
  Time: 'Time',
  Color: 'Color',
  Duration: 'Duration',
  Clone: 'Clone',
  Location: 'Location',
  Active: 'Active',
  Uptime: 'Uptime',
  Nodes: 'Nodes',
  Inspect: 'Inspect',
  Failed: 'Failed',
  Reload: 'Reload',
  Anomalies: 'Anomalies',
  Auto: 'Auto',
  Other: 'Other',
  Request: 'Request',
  Documents: 'Documents',
  Left: 'Left',
  Right: 'Right',
  Throughput: 'Throughput',
  Host: 'Host',
  User: 'User',
  Severity: 'Severity',
  Collapse: 'Collapse',
  Loading: 'Loading',
  Frequency: 'Frequency',
  Interval: 'Interval',
  Advanced: 'Advanced',
  Top: 'Top',
  Latency: 'Latency',
  View: 'View',
  Method: 'Method',
  Groups: 'Groups',
  Users: 'Users',
  Mappings: 'Mappings',
  Aliases: 'Aliases',
  Logistics: 'Logistics',
  State: 'State',
  Jobs: 'Jobs',
  Fields: 'Fields',
  Filters: 'Filters',
  Descending: 'Descending',
  Node: 'Node',
  'Loading…': 'Loading…',
  JSON: 'JSON',
  Next: 'Next',
  ms: 'ms',
  Integrations: 'Integrations',
  Format: 'Format',
  Import: 'Import',
  Created: 'Created',
  Bottom: 'Bottom',
  Labels: 'Labels',
  'N/A': 'N/A',
  Metadata: 'Metadata',
  Instances: 'Instances',
  Start: 'Start',
  Message: 'Message',
  Client: 'Client',
  Category: 'Category',
  Custom: 'Custom',
  Default: 'Default',
  Expand: 'Expand',
  Select: 'Select',
  Analytics: 'Analytics',
  Security: 'Security',
  Ascending: 'Ascending',
  Percentile: 'Percentile',
  Date: 'Date',
  Image: 'Image',
  Progress: 'Progress',
  Number: 'Number',
  Size: 'Size',
  Enable: 'Enable',
  Text: 'Text',
  OS: 'OS',
  Service: 'Service',
  Optional: 'Optional',
  Source: 'Source',
  Confirm: 'Confirm',
  Graph: 'Graph',
  AND: 'AND',
  Rules: 'Rules',
  'Read-only': 'Read-only',
  Off: 'Off',
  Dashboard: 'Dashboard',
  Help: 'Help',
  Errors: 'Errors',
  of: 'of',
  'Loading...': 'Loading...',
  Open: 'Open',
  Bytes: 'Bytes',
  Username: 'Username',
  Password: 'Password',
  Browser: 'Browser',
  From: 'From',
  To: 'To',
  Bucket: 'Bucket',
  Linear: 'Linear',
  'X-axis': 'X-axis',
  Line: 'Line',
  Mode: 'Mode',
  seconds: 'seconds',
  Visualization: 'Visualization',
  Hide: 'Hide',
  Spaces: 'Spaces',
  Configuration: 'Configuration',
  Network: 'Network',
  Schedule: 'Schedule',
  Repository: 'Repository',
  History: 'History',
  Copy: 'Copy',
  Exclude: 'Exclude',
  Reason: 'Reason',
  New: 'New',
  Shape: 'Shape',
  Url: 'Url',
  Success: 'Success',
  Order: 'Order',
  'Y-axis': 'Y-axis',
  Style: 'Style',
  True: 'True',
  False: 'False',
  days: 'days',
  Action: 'Action',
  Critical: 'Critical',
  Environment: 'Environment',
  Closed: 'Closed',
  Alert: 'Alert',
  Policy: 'Policy',
  File: 'File',
  in: 'in',
  Agents: 'Agents',
  '(incomplete)': '(incomplete)',
  Packs: 'Packs',
  Monitors: 'Monitors',
  On: 'On',
  General: 'General',
  Include: 'Include',
  'Select...': 'Select...',
  Minute: 'Minute',
  is: 'is',
  min: 'min',
  Key: 'Key',
  Output: 'Output',
  Function: 'Function',
  Comment: 'Comment',
  minutes: 'minutes',
  hours: 'hours',
  field: 'field',
  Impact: 'Impact',
  Policies: 'Policies',
  Enabled: 'Enabled',
  Investigate: 'Investigate',
  Cases: 'Cases',
  Comments: 'Comments',
  Priority: 'Priority',
  Timestamp: 'Timestamp',
  IP: 'IP',
  Managed: 'Managed',
  Stop: 'Stop',
  Namespace: 'Namespace',
  Conditions: 'Conditions',
  Platform: 'Platform',
  Transforms: 'Transforms',
  '/s': '/s',
  when: 'when',
  Reporting: 'Reporting',
  Red: 'Red',
  Medium: 'Medium',
  Hour: 'Hour',
  Histogram: 'Histogram',
  Terms: 'Terms',
  exists: 'exists',
  unknown: 'unknown',
  Operator: 'Operator',
  Values: 'Values',
  Disabled: 'Disabled',
  docs: 'docs',
  At: 'At',
  Boolean: 'Boolean',
  Minutes: 'Minutes',
  Days: 'Days',
  '(empty)': '(empty)',
  Requests: 'Requests',
  Kibana: 'Kibana',
  Export: 'Export',
  Raw: 'Raw',
  Healthy: 'Healthy',
  Device: 'Device',
  Health: 'Health',
  Container: 'Container',
  Services: 'Services',
  Fleet: 'Fleet',
  Rule: 'Rule',
  Copied: 'Copied',
  Continue: 'Continue',
  Path: 'Path',
  out: 'out',
  Connections: 'Connections',
  '1m': '1m',
  Memory: 'Memory',
  Show: 'Show',
  Offline: 'Offline',
  License: 'License',
  Windows: 'Windows',
  Pipelines: 'Pipelines',
  Calendars: 'Calendars',
  Mute: 'Mute',
  Watcher: 'Watcher',
  Roles: 'Roles',
  DNS: 'DNS',
  Process: 'Process',
  Templates: 'Templates',
  Clear: 'Clear',
  Updating: 'Updating',
  Management: 'Management',
  or: 'or',
  Hits: 'Hits',
  Table: 'Table',
  Gauge: 'Gauge',
  Seconds: 'Seconds',
  Hours: 'Hours',
  Percentage: 'Percentage',
  Beats: 'Beats',
  Disable: 'Disable',
  Log: 'Log',
  Percent: 'Percent',
  Tag: 'Tag',
  Annotations: 'Annotations',
  Template: 'Template',
  Everything: 'Everything',
  Stacked: 'Stacked',
  Bar: 'Bar',
  Alignment: 'Alignment',
  Area: 'Area',
  Trigger: 'Trigger',
  Recovered: 'Recovered',
  index: 'index',
  Center: 'Center',
  Dependencies: 'Dependencies',
  OK: 'OK',
  Required: 'Required',
  Platinum: 'Platinum',
  Transactions: 'Transactions',
  APM: 'APM',
  Group: 'Group',
  Zoom: 'Zoom',
  left: 'left',
  right: 'right',
  Column: 'Column',
  Display: 'Display',
  Lens: 'Lens',
  Endpoint: 'Endpoint',
  Pending: 'Pending',
  Running: 'Running',
  Ok: 'Ok',
  documentation: 'documentation',
  Stats: 'Stats',
  Primaries: 'Primaries',
  System: 'System',
  writes: 'writes',
  reads: 'reads',
  '5m': '5m',
  '15m': '15m',
  Threshold: 'Threshold',
  Categories: 'Categories',
  Stopped: 'Stopped',
  Maps: 'Maps',
  OR: 'OR',
  Destination: 'Destination',
  Detector: 'Detector',
  Started: 'Started',
  close: 'close',
  Rare: 'Rare',
  Logstash: 'Logstash',
  Linux: 'Linux',
  Showing: 'Showing',
  Notes: 'Notes',
  Authentication: 'Authentication',
  Snapshots: 'Snapshots',
  Port: 'Port',
  Load: 'Load',
  Delay: 'Delay',
  Columns: 'Columns',
  Normal: 'Normal',
  Last: 'Last',
  Dashboards: 'Dashboards',
  Small: 'Small',
  Large: 'Large',
  Range: 'Range',
  Median: 'Median',
  Shard: 'Shard',
  Searchable: 'Searchable',
  search: 'search',
  Weeks: 'Weeks',
  Months: 'Months',
  s: 's',
  String: 'String',
  Link: 'Link',
  Home: 'Home',
  Rollup: 'Rollup',
  Language: 'Language',
  'Search…': 'Search…',
  Sort: 'Sort',
  Overwrite: 'Overwrite',
  Rows: 'Rows',
  Discard: 'Discard',
  Cardinality: 'Cardinality',
  Avg: 'Avg',
  Horizontal: 'Horizontal',
  Vertical: 'Vertical',
  Full: 'Full',
  Position: 'Position',
  Tools: 'Tools',
  Email: 'Email',
  Jira: 'Jira',
  Slack: 'Slack',
  critical: 'critical',
  major: 'major',
  minor: 'minor',
  warning: 'warning',
  Occurrences: 'Occurrences',
  Realm: 'Realm',
  Schema: 'Schema',
  Appearance: 'Appearance',
  Set: 'Set',
  Fill: 'Fill',
  Orientation: 'Orientation',
  Run: 'Run',
  Saving: 'Saving',
  Paused: 'Paused',
  Expired: 'Expired',
  Results: 'Results',
  Skipped: 'Skipped',
  Engines: 'Engines',
  Customize: 'Customize',
  Review: 'Review',
  Content: 'Content',
  median: 'median',
  max: 'max',
  count: 'count',
  Analyzer: 'Analyzer',
  Rate: 'Rate',
  'Success!': 'Success!',
  Categorization: 'Categorization',
  Typical: 'Typical',
  Actual: 'Actual',
  Dataset: 'Dataset',
  Stream: 'Stream',
  Job: 'Job',
  Minimum: 'Minimum',
  'Saving…': 'Saving…',
  Unhealthy: 'Unhealthy',
  Elasticsearch: 'Elasticsearch',
  Duplicate: 'Duplicate',
  Map: 'Map',
  deleting: 'deleting',
  resetting: 'resetting',
  Influencers: 'Influencers',
  actual: 'actual',
  typical: 'typical',
  Overall: 'Overall',
  Datafeed: 'Datafeed',
  Acknowledged: 'Acknowledged',
  Indexing: 'Indexing',
  Explore: 'Explore',
  TLS: 'TLS',
  Timelines: 'Timelines',
  rule: 'rule',
  via: 'via',
  Repositories: 'Repositories',
  over: 'over',
  Resolved: 'Resolved',
};
