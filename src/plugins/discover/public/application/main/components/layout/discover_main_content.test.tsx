/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import React from 'react';
import { Subject, BehaviorSubject } from 'rxjs';
import { mountWithIntl } from '@kbn/test-jest-helpers';
import { esHits } from '../../../../__mocks__/es_hits';
import { dataViewMock } from '../../../../__mocks__/data_view';
import { savedSearchMock } from '../../../../__mocks__/saved_search';
import { GetStateReturn } from '../../services/discover_state';
import {
  AvailableFields$,
  DataCharts$,
  DataDocuments$,
  DataMain$,
  DataTotalHits$,
  RecordRawType,
} from '../../hooks/use_saved_search';
import { discoverServiceMock } from '../../../../__mocks__/services';
import { FetchStatus } from '../../../types';
import { Chart } from '../chart/point_series';
import { KibanaContextProvider, KibanaThemeProvider } from '@kbn/kibana-react-plugin/public';
import { buildDataTableRecord } from '../../../../utils/build_data_record';
import { DiscoverMainContent, DiscoverMainContentProps } from './discover_main_content';
import { VIEW_MODE } from '@kbn/saved-search-plugin/public';
import { DiscoverPanels, DISCOVER_PANELS_MODE } from './discover_panels';
import { euiThemeVars } from '@kbn/ui-theme';
import { CoreTheme } from '@kbn/core/public';
import { act } from 'react-dom/test-utils';
import { setTimeout } from 'timers/promises';
import { DiscoverChart } from '../chart';
import { ReactWrapper } from 'enzyme';
import { DocumentViewModeToggle } from '../../../../components/view_mode_toggle';

const mountComponent = async ({
  isPlainRecord = false,
  hideChart = false,
  isTimeBased = true,
}: {
  isPlainRecord?: boolean;
  hideChart?: boolean;
  isTimeBased?: boolean;
} = {}) => {
  const services = discoverServiceMock;
  services.data.query.timefilter.timefilter.getAbsoluteTime = () => {
    return { from: '2020-05-14T11:05:13.590', to: '2020-05-14T11:20:13.590' };
  };

  const main$ = new BehaviorSubject({
    fetchStatus: FetchStatus.COMPLETE,
    recordRawType: isPlainRecord ? RecordRawType.PLAIN : RecordRawType.DOCUMENT,
    foundDocuments: true,
  }) as DataMain$;

  const documents$ = new BehaviorSubject({
    fetchStatus: FetchStatus.COMPLETE,
    result: esHits.map((esHit) => buildDataTableRecord(esHit, dataViewMock)),
  }) as DataDocuments$;

  const availableFields$ = new BehaviorSubject({
    fetchStatus: FetchStatus.COMPLETE,
    fields: [] as string[],
  }) as AvailableFields$;

  const totalHits$ = new BehaviorSubject({
    fetchStatus: FetchStatus.COMPLETE,
    result: Number(esHits.length),
  }) as DataTotalHits$;

  const chartData = {
    xAxisOrderedValues: [
      1623880800000, 1623967200000, 1624053600000, 1624140000000, 1624226400000, 1624312800000,
      1624399200000, 1624485600000, 1624572000000, 1624658400000, 1624744800000, 1624831200000,
      1624917600000, 1625004000000, 1625090400000,
    ],
    xAxisFormat: { id: 'date', params: { pattern: 'YYYY-MM-DD' } },
    xAxisLabel: 'order_date per day',
    yAxisFormat: { id: 'number' },
    ordered: {
      date: true,
      interval: {
        asMilliseconds: jest.fn(),
      },
      intervalESUnit: 'd',
      intervalESValue: 1,
      min: '2021-03-18T08:28:56.411Z',
      max: '2021-07-01T07:28:56.411Z',
    },
    yAxisLabel: 'Count',
    values: [
      { x: 1623880800000, y: 134 },
      { x: 1623967200000, y: 152 },
      { x: 1624053600000, y: 141 },
      { x: 1624140000000, y: 138 },
      { x: 1624226400000, y: 142 },
      { x: 1624312800000, y: 157 },
      { x: 1624399200000, y: 149 },
      { x: 1624485600000, y: 146 },
      { x: 1624572000000, y: 170 },
      { x: 1624658400000, y: 137 },
      { x: 1624744800000, y: 150 },
      { x: 1624831200000, y: 144 },
      { x: 1624917600000, y: 147 },
      { x: 1625004000000, y: 137 },
      { x: 1625090400000, y: 66 },
    ],
  } as unknown as Chart;

  const charts$ = new BehaviorSubject({
    fetchStatus: FetchStatus.COMPLETE,
    chartData,
    bucketInterval: {
      scaled: true,
      description: 'test',
      scale: 2,
    },
  }) as DataCharts$;

  const savedSearchData$ = {
    main$,
    documents$,
    totalHits$,
    charts$,
    availableFields$,
  };

  const props: DiscoverMainContentProps = {
    isPlainRecord,
    dataView: dataViewMock,
    navigateTo: jest.fn(),
    resetSavedSearch: jest.fn(),
    setExpandedDoc: jest.fn(),
    savedSearch: savedSearchMock,
    savedSearchData$,
    savedSearchRefetch$: new Subject(),
    state: { columns: [], hideChart },
    stateContainer: {
      setAppState: () => {},
      appStateContainer: {
        getState: () => ({
          interval: 'auto',
        }),
      },
    } as unknown as GetStateReturn,
    isTimeBased,
    viewMode: VIEW_MODE.DOCUMENT_LEVEL,
    onAddFilter: jest.fn(),
    onFieldEdited: jest.fn(),
    columns: [],
    resizeRef: { current: null },
  };

  const coreTheme$ = new BehaviorSubject<CoreTheme>({ darkMode: false });

  const component = mountWithIntl(
    <KibanaContextProvider services={services}>
      <KibanaThemeProvider theme$={coreTheme$}>
        <DiscoverMainContent {...props} />
      </KibanaThemeProvider>
    </KibanaContextProvider>
  );

  // useIsWithinBreakpoints triggers state updates which cause act
  // issues and prevent our resize events from being fired correctly
  // https://github.com/enzymejs/enzyme/issues/2073
  await act(() => setTimeout(0));

  return component;
};

const setWindowWidth = (component: ReactWrapper, width: string) => {
  window.innerWidth = parseInt(width, 10);
  act(() => {
    window.dispatchEvent(new Event('resize'));
  });
  component.update();
};

describe('Discover main content component', () => {
  const windowWidth = window.innerWidth;

  beforeEach(() => {
    window.innerWidth = windowWidth;
  });

  it('should set the panels mode to DISCOVER_PANELS_MODE.RESIZABLE when viewing on medium screens and above', async () => {
    const component = await mountComponent();
    setWindowWidth(component, euiThemeVars.euiBreakpoints.m);
    expect(component.find(DiscoverPanels).prop('mode')).toBe(DISCOVER_PANELS_MODE.RESIZABLE);
  });

  it('should set the panels mode to DISCOVER_PANELS_MODE.FIXED when viewing on small screens and below', async () => {
    const component = await mountComponent();
    setWindowWidth(component, euiThemeVars.euiBreakpoints.s);
    expect(component.find(DiscoverPanels).prop('mode')).toBe(DISCOVER_PANELS_MODE.FIXED);
  });

  it('should set the panels mode to DISCOVER_PANELS_MODE.FIXED if hideChart is true', async () => {
    const component = await mountComponent({ hideChart: true });
    expect(component.find(DiscoverPanels).prop('mode')).toBe(DISCOVER_PANELS_MODE.FIXED);
  });

  it('should set the panels mode to DISCOVER_PANELS_MODE.FIXED if isTimeBased is false', async () => {
    const component = await mountComponent({ isTimeBased: false });
    expect(component.find(DiscoverPanels).prop('mode')).toBe(DISCOVER_PANELS_MODE.FIXED);
  });

  it('should set the panels mode to DISCOVER_PANELS_MODE.SINGLE if isPlainRecord is true', async () => {
    const component = await mountComponent({ isPlainRecord: true });
    expect(component.find(DiscoverPanels).prop('mode')).toBe(DISCOVER_PANELS_MODE.SINGLE);
  });

  it('should set a fixed height for DiscoverChart when panels mode is DISCOVER_PANELS_MODE.FIXED and hideChart is false', async () => {
    const component = await mountComponent();
    setWindowWidth(component, euiThemeVars.euiBreakpoints.s);
    const expectedHeight = component.find(DiscoverPanels).prop('initialTopPanelHeight');
    expect(component.find(DiscoverChart).childAt(0).getDOMNode()).toHaveStyle({
      height: `${expectedHeight}px`,
    });
  });

  it('should not set a fixed height for DiscoverChart when panels mode is DISCOVER_PANELS_MODE.FIXED and hideChart is true', async () => {
    const component = await mountComponent({ hideChart: true });
    setWindowWidth(component, euiThemeVars.euiBreakpoints.s);
    const expectedHeight = component.find(DiscoverPanels).prop('initialTopPanelHeight');
    expect(component.find(DiscoverChart).childAt(0).getDOMNode()).not.toHaveStyle({
      height: `${expectedHeight}px`,
    });
  });

  it('should not set a fixed height for DiscoverChart when panels mode is DISCOVER_PANELS_MODE.FIXED and isTimeBased is false', async () => {
    const component = await mountComponent({ isTimeBased: false });
    setWindowWidth(component, euiThemeVars.euiBreakpoints.s);
    const expectedHeight = component.find(DiscoverPanels).prop('initialTopPanelHeight');
    expect(component.find(DiscoverChart).childAt(0).getDOMNode()).not.toHaveStyle({
      height: `${expectedHeight}px`,
    });
  });

  it('should show DocumentViewModeToggle when isPlainRecord is false', async () => {
    const component = await mountComponent();
    expect(component.find(DocumentViewModeToggle).exists()).toBe(true);
  });

  it('should not show DocumentViewModeToggle when isPlainRecord is true', async () => {
    const component = await mountComponent({ isPlainRecord: true });
    expect(component.find(DocumentViewModeToggle).exists()).toBe(false);
  });
});
