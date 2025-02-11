/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import { mount, ReactWrapper } from 'enzyme';
import React, { ReactElement, RefObject } from 'react';
import { DiscoverPanelsResizable } from './discover_panels_resizable';
import { act } from 'react-dom/test-utils';

const containerHeight = 1000;
const topPanelId = 'topPanel';

jest.mock('@elastic/eui', () => ({
  ...jest.requireActual('@elastic/eui'),
  useResizeObserver: jest.fn(),
  useGeneratedHtmlId: jest.fn(() => topPanelId),
}));

import * as eui from '@elastic/eui';
import { waitFor } from '@testing-library/dom';

describe('Discover panels resizable', () => {
  const mountComponent = ({
    className = '',
    resizeRef = { current: null },
    initialTopPanelHeight = 0,
    minTopPanelHeight = 0,
    minMainPanelHeight = 0,
    topPanel = <></>,
    mainPanel = <></>,
    attachTo,
  }: {
    className?: string;
    resizeRef?: RefObject<HTMLDivElement>;
    initialTopPanelHeight?: number;
    minTopPanelHeight?: number;
    minMainPanelHeight?: number;
    topPanel?: ReactElement;
    mainPanel?: ReactElement;
    attachTo?: HTMLElement;
  }) => {
    return mount(
      <DiscoverPanelsResizable
        className={className}
        resizeRef={resizeRef}
        initialTopPanelHeight={initialTopPanelHeight}
        minTopPanelHeight={minTopPanelHeight}
        minMainPanelHeight={minMainPanelHeight}
        topPanel={topPanel}
        mainPanel={mainPanel}
      />,
      attachTo ? { attachTo } : undefined
    );
  };

  const expectCorrectPanelSizes = (
    component: ReactWrapper,
    currentContainerHeight: number,
    topPanelHeight: number
  ) => {
    const topPanelSize = (topPanelHeight / currentContainerHeight) * 100;
    expect(component.find('[data-test-subj="dscResizablePanelTop"]').at(0).prop('size')).toBe(
      topPanelSize
    );
    expect(component.find('[data-test-subj="dscResizablePanelMain"]').at(0).prop('size')).toBe(
      100 - topPanelSize
    );
  };

  const forceRender = (component: ReactWrapper) => {
    component.setProps({}).update();
  };

  beforeEach(() => {
    jest.spyOn(eui, 'useResizeObserver').mockReturnValue({ height: containerHeight, width: 0 });
  });

  it('should render both panels', () => {
    const topPanel = <div data-test-subj="topPanel" />;
    const mainPanel = <div data-test-subj="mainPanel" />;
    const component = mountComponent({ topPanel, mainPanel });
    expect(component.contains(topPanel)).toBe(true);
    expect(component.contains(mainPanel)).toBe(true);
  });

  it('should set the initial heights of both panels', () => {
    const initialTopPanelHeight = 200;
    const component = mountComponent({ initialTopPanelHeight });
    expectCorrectPanelSizes(component, containerHeight, initialTopPanelHeight);
  });

  it('should set the correct heights of both panels when the panels are resized', () => {
    const initialTopPanelHeight = 200;
    const component = mountComponent({ initialTopPanelHeight });
    expectCorrectPanelSizes(component, containerHeight, initialTopPanelHeight);
    const newTopPanelSize = 30;
    const onPanelSizeChange = component
      .find('[data-test-subj="dscResizableContainer"]')
      .at(0)
      .prop('onPanelWidthChange') as Function;
    act(() => {
      onPanelSizeChange({ [topPanelId]: newTopPanelSize });
    });
    forceRender(component);
    expectCorrectPanelSizes(component, containerHeight, containerHeight * (newTopPanelSize / 100));
  });

  it('should maintain the height of the top panel and resize the main panel when the container height changes', () => {
    const initialTopPanelHeight = 200;
    const component = mountComponent({ initialTopPanelHeight });
    expectCorrectPanelSizes(component, containerHeight, initialTopPanelHeight);
    const newContainerHeight = 2000;
    jest.spyOn(eui, 'useResizeObserver').mockReturnValue({ height: newContainerHeight, width: 0 });
    forceRender(component);
    expectCorrectPanelSizes(component, newContainerHeight, initialTopPanelHeight);
  });

  it('should resize the top panel once the main panel is at its minimum height', () => {
    const initialTopPanelHeight = 500;
    const minTopPanelHeight = 100;
    const minMainPanelHeight = 100;
    const component = mountComponent({
      initialTopPanelHeight,
      minTopPanelHeight,
      minMainPanelHeight,
    });
    expectCorrectPanelSizes(component, containerHeight, initialTopPanelHeight);
    const newContainerHeight = 400;
    jest.spyOn(eui, 'useResizeObserver').mockReturnValue({ height: newContainerHeight, width: 0 });
    forceRender(component);
    expectCorrectPanelSizes(component, newContainerHeight, newContainerHeight - minMainPanelHeight);
    jest.spyOn(eui, 'useResizeObserver').mockReturnValue({ height: containerHeight, width: 0 });
    forceRender(component);
    expectCorrectPanelSizes(component, containerHeight, initialTopPanelHeight);
  });

  it('should maintain the minimum heights of both panels when the container is too small to fit them', () => {
    const initialTopPanelHeight = 500;
    const minTopPanelHeight = 100;
    const minMainPanelHeight = 150;
    const component = mountComponent({
      initialTopPanelHeight,
      minTopPanelHeight,
      minMainPanelHeight,
    });
    expectCorrectPanelSizes(component, containerHeight, initialTopPanelHeight);
    const newContainerHeight = 200;
    jest.spyOn(eui, 'useResizeObserver').mockReturnValue({ height: newContainerHeight, width: 0 });
    forceRender(component);
    expect(component.find('[data-test-subj="dscResizablePanelTop"]').at(0).prop('size')).toBe(
      (minTopPanelHeight / newContainerHeight) * 100
    );
    expect(component.find('[data-test-subj="dscResizablePanelMain"]').at(0).prop('size')).toBe(
      (minMainPanelHeight / newContainerHeight) * 100
    );
    jest.spyOn(eui, 'useResizeObserver').mockReturnValue({ height: containerHeight, width: 0 });
    forceRender(component);
    expectCorrectPanelSizes(component, containerHeight, initialTopPanelHeight);
  });

  it('should blur the resize button after a resize', async () => {
    const attachTo = document.createElement('div');
    document.body.appendChild(attachTo);
    const component = mountComponent({ attachTo });
    const wrapper = component.find('[data-test-subj="dscResizableContainerWrapper"]');
    const resizeButton = component.find('button[data-test-subj="dsc-resizable-button"]');
    const resizeButtonInner = component.find('[data-test-subj="dscResizableButtonInner"]');
    const mouseEvent = {
      pageX: 0,
      pageY: 0,
      clientX: 0,
      clientY: 0,
    };
    resizeButtonInner.simulate('mousedown', mouseEvent);
    resizeButton.simulate('mousedown', mouseEvent);
    (resizeButton.getDOMNode() as HTMLElement).focus();
    wrapper.simulate('mouseup', mouseEvent);
    resizeButton.simulate('click', mouseEvent);
    expect(resizeButton.getDOMNode()).toHaveFocus();
    await waitFor(() => {
      expect(resizeButton.getDOMNode()).not.toHaveFocus();
    });
  });
});
