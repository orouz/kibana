/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import * as t from 'io-ts';
import {
  compareFrameGroup,
  createFrameGroup,
  createFrameGroupID,
  FrameGroup,
  FrameGroupID,
} from './frame_group';
import {
  Executable,
  FileID,
  groupStackFrameMetadataByStackTrace,
  StackFrame,
  StackFrameID,
  StackFrameMetadata,
  StackTrace,
  StackTraceID,
} from './profiling';

interface TopNFunctionAndFrameGroup {
  Frame: StackFrameMetadata;
  FrameGroup: FrameGroup;
  CountExclusive: number;
  CountInclusive: number;
}

type TopNFunction = Pick<
  TopNFunctionAndFrameGroup,
  'Frame' | 'CountExclusive' | 'CountInclusive'
> & { Id: string; Rank: number };

export interface TopNFunctions {
  TotalCount: number;
  TopN: TopNFunction[];
}

export function createTopNFunctions(
  events: Map<StackTraceID, number>,
  stackTraces: Map<StackTraceID, StackTrace>,
  stackFrames: Map<StackFrameID, StackFrame>,
  executables: Map<FileID, Executable>,
  startIndex: number,
  endIndex: number
): TopNFunctions {
  const metadata = groupStackFrameMetadataByStackTrace(stackTraces, stackFrames, executables);

  // The `count` associated with a frame provides the total number of
  // traces in which that node has appeared at least once. However, a
  // frame may appear multiple times in a trace, and thus to avoid
  // counting it multiple times we need to record the frames seen so
  // far in each trace.
  let totalCount = 0;
  const topNFunctions = new Map<FrameGroupID, TopNFunctionAndFrameGroup>();

  // Collect metadata and inclusive + exclusive counts for each distinct frame.
  for (const [traceHash, count] of events) {
    const uniqueFrameGroupsPerEvent = new Set<FrameGroupID>();

    totalCount += count;

    // It is possible that we do not have a stacktrace for an event,
    // e.g. when stopping the host agent or on network errors.
    const frames = metadata.get(traceHash) ?? [];
    for (let i = 0; i < frames.length; i++) {
      const frameGroup = createFrameGroup(frames[i]);
      const frameGroupID = createFrameGroupID(frameGroup);

      if (!topNFunctions.has(frameGroupID)) {
        topNFunctions.set(frameGroupID, {
          Frame: frames[i],
          FrameGroup: frameGroup,
          CountExclusive: 0,
          CountInclusive: 0,
        });
      }

      const topNFunction = topNFunctions.get(frameGroupID)!;

      if (!uniqueFrameGroupsPerEvent.has(frameGroupID)) {
        uniqueFrameGroupsPerEvent.add(frameGroupID);
        topNFunction.CountInclusive += count;
      }

      if (i === frames.length - 1) {
        // Leaf frame: sum up counts for exclusive CPU.
        topNFunction.CountExclusive += count;
      }
    }
  }

  // Sort in descending order by exclusive CPU. Same values should appear in a
  // stable order, so compare the FrameGroup in this case.
  const topN = [...topNFunctions.values()];
  topN
    .sort((a: TopNFunctionAndFrameGroup, b: TopNFunctionAndFrameGroup) => {
      if (a.CountExclusive > b.CountExclusive) {
        return 1;
      }
      if (a.CountExclusive < b.CountExclusive) {
        return -1;
      }
      return compareFrameGroup(a.FrameGroup, b.FrameGroup);
    })
    .reverse();

  if (startIndex > topN.length) {
    startIndex = topN.length;
  }
  if (endIndex > topN.length) {
    endIndex = topN.length;
  }

  const framesAndCountsAndIds = topN.slice(startIndex, endIndex).map((frameAndCount, i) => ({
    Rank: i + 1,
    Frame: frameAndCount.Frame,
    CountExclusive: frameAndCount.CountExclusive,
    CountInclusive: frameAndCount.CountInclusive,
    Id: createFrameGroupID(frameAndCount.FrameGroup),
  }));

  return {
    TotalCount: totalCount,
    TopN: framesAndCountsAndIds,
  };
}

export enum TopNFunctionSortField {
  Rank = 'rank',
  Frame = 'frame',
  Samples = 'samples',
  ExclusiveCPU = 'exclusiveCPU',
  InclusiveCPU = 'inclusiveCPU',
  Diff = 'diff',
}

export const topNFunctionSortFieldRt = t.union([
  t.literal(TopNFunctionSortField.Rank),
  t.literal(TopNFunctionSortField.Frame),
  t.literal(TopNFunctionSortField.Samples),
  t.literal(TopNFunctionSortField.ExclusiveCPU),
  t.literal(TopNFunctionSortField.InclusiveCPU),
  t.literal(TopNFunctionSortField.Diff),
]);
