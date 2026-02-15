/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { AnalyticsServiceSetup, EventTypeOpts } from '@kbn/core/server';

export class TelemetryService {
  constructor(private readonly analytics: AnalyticsServiceSetup) {}

  public reportEvent<T>(eventTypeOpts: EventTypeOpts<T>, eventData: T): void {
    this.analytics.reportEvent(eventTypeOpts.eventType, eventData as object);
  }
}
