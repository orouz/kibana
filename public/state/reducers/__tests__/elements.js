import expect from 'expect.js';
import { get } from 'lodash';
import actionCreator from './fixtures/action_creator';
import reducer from '../elements';

describe('elements reducer', () => {
  let state;

  beforeEach(() => {
    state = {
      id: 'workpad-1',
      pages: [{
        id: 'page-1',
        elements: [{
          id: 'element-0',
          expression: '',
        }, {
          id: 'element-1',
          expression: 'demodata',
        }],
      }],
    };
  });

  it('expressionActions update element expression by id', () => {
    const expression = 'test expression';
    const expected = {
      id: 'element-1',
      expression,
    };
    const action = actionCreator('setExpression')({
      expression,
      elementId: 'element-1',
      pageId: 'page-1',
    });

    const newState = reducer(state, action);
    const newElement = get(newState, ['pages', 0, 'elements', 1]);

    expect(newElement).to.eql(expected);
  });
});
