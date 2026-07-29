/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { TaskManagerStartContract } from '@kbn/task-manager-plugin/server';
import { loggerMock } from '@kbn/logging-mocks';
import { rescheduleExtractEntityTasks } from './extract_entity_task';

describe('rescheduleExtractEntityTasks', () => {
  const namespace = 'default';
  const frequency = '22m';
  let mockTaskManager: jest.Mocked<Pick<TaskManagerStartContract, 'bulkUpdateSchedules'>>;
  let mockLogger: ReturnType<typeof loggerMock.create>;

  beforeEach(() => {
    mockTaskManager = {
      bulkUpdateSchedules: jest.fn().mockResolvedValue({ tasks: [], errors: [] }),
    };
    mockLogger = loggerMock.create();
  });

  it('no-ops when there are no entity types', async () => {
    await rescheduleExtractEntityTasks({
      logger: mockLogger,
      taskManager: mockTaskManager as unknown as TaskManagerStartContract,
      types: [],
      namespace,
      frequency,
    });

    expect(mockTaskManager.bulkUpdateSchedules).not.toHaveBeenCalled();
  });

  it('updates schedules for all extract entity task ids in one call', async () => {
    await rescheduleExtractEntityTasks({
      logger: mockLogger,
      taskManager: mockTaskManager as unknown as TaskManagerStartContract,
      types: ['host', 'user'],
      namespace,
      frequency,
    });

    expect(mockTaskManager.bulkUpdateSchedules).toHaveBeenCalledTimes(1);
    expect(mockTaskManager.bulkUpdateSchedules).toHaveBeenCalledWith(
      [
        'entity_store:v2:extract_entity_task:host:default',
        'entity_store:v2:extract_entity_task:user:default',
      ],
      { interval: frequency }
    );
  });

  it('ignores not-found errors from bulkUpdateSchedules', async () => {
    mockTaskManager.bulkUpdateSchedules.mockResolvedValue({
      tasks: [],
      errors: [
        {
          id: 'entity_store:v2:extract_entity_task:host:default',
          type: 'task',
          error: { statusCode: 404, error: 'Not Found', message: 'Saved object not found' },
        },
      ],
    });

    await expect(
      rescheduleExtractEntityTasks({
        logger: mockLogger,
        taskManager: mockTaskManager as unknown as TaskManagerStartContract,
        types: ['host'],
        namespace,
        frequency,
      })
    ).resolves.toBeUndefined();
  });

  it('throws on unexpected bulkUpdateSchedules errors', async () => {
    mockTaskManager.bulkUpdateSchedules.mockResolvedValue({
      tasks: [],
      errors: [
        {
          id: 'entity_store:v2:extract_entity_task:host:default',
          type: 'task',
          error: { statusCode: 500, error: 'Internal', message: 'boom' },
        },
      ],
    });

    await expect(
      rescheduleExtractEntityTasks({
        logger: mockLogger,
        taskManager: mockTaskManager as unknown as TaskManagerStartContract,
        types: ['host'],
        namespace,
        frequency,
      })
    ).rejects.toThrow('boom');
  });
});
