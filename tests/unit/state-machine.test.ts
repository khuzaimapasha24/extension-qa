import { describe, it, expect, beforeEach } from 'vitest';
import { AgentStateMachine } from '../../src/agent/state-machine';

describe('AgentStateMachine', () => {
  let sm: AgentStateMachine;

  beforeEach(() => {
    sm = new AgentStateMachine('IDLE');
  });

  it('starts at IDLE state', () => {
    expect(sm.getState()).toBe('IDLE');
  });

  it('allows valid state progression through full QA pipeline', () => {
    expect(sm.transitionTo('INITIALIZING')).toBe(true);
    expect(sm.getState()).toBe('INITIALIZING');

    expect(sm.transitionTo('DISCOVERING')).toBe(true);
    expect(sm.getState()).toBe('DISCOVERING');

    expect(sm.transitionTo('ANALYZING')).toBe(true);
    expect(sm.getState()).toBe('ANALYZING');

    expect(sm.transitionTo('PLANNING')).toBe(true);
    expect(sm.getState()).toBe('PLANNING');

    expect(sm.transitionTo('EXECUTING')).toBe(true);
    expect(sm.getState()).toBe('EXECUTING');

    expect(sm.transitionTo('OBSERVING')).toBe(true);
    expect(sm.getState()).toBe('OBSERVING');

    expect(sm.transitionTo('REASONING')).toBe(true);
    expect(sm.getState()).toBe('REASONING');

    expect(sm.transitionTo('VERIFYING')).toBe(true);
    expect(sm.getState()).toBe('VERIFYING');

    expect(sm.transitionTo('REPORTING')).toBe(true);
    expect(sm.getState()).toBe('REPORTING');

    expect(sm.transitionTo('COMPLETED')).toBe(true);
    expect(sm.getState()).toBe('COMPLETED');
  });

  it('rejects illegal transitions without altering state', () => {
    // Cannot jump from IDLE directly to EXECUTING
    expect(sm.transitionTo('EXECUTING')).toBe(false);
    expect(sm.getState()).toBe('IDLE');

    // Cannot jump from IDLE directly to REPORTING
    expect(sm.transitionTo('REPORTING')).toBe(false);
    expect(sm.getState()).toBe('IDLE');
  });

  it('allows transitioning to ERROR from any active state and resetting to IDLE', () => {
    sm.transitionTo('INITIALIZING');
    sm.transitionTo('DISCOVERING');
    expect(sm.transitionTo('ERROR')).toBe(true);
    expect(sm.getState()).toBe('ERROR');

    // Resetting back to IDLE
    expect(sm.transitionTo('IDLE')).toBe(true);
    expect(sm.getState()).toBe('IDLE');
  });

  it('records state transition history', () => {
    sm.transitionTo('INITIALIZING');
    sm.transitionTo('DISCOVERING');
    const history = sm.getHistory();
    expect(history.length).toBe(2);
    expect(history[0].from).toBe('IDLE');
    expect(history[0].to).toBe('INITIALIZING');
    expect(history[1].from).toBe('INITIALIZING');
    expect(history[1].to).toBe('DISCOVERING');
  });
});
