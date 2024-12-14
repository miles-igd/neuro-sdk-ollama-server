export interface Action {
  name: string;
  description: string;
  schema: string;
}

export enum C2S {
  STARTUP = 'startup',
  CONTEXT = 'context',
  ACTIONS_REGISTER = 'actions/register',
  ACTIONS_UNREGISTER = 'actions/unregister',
  ACTIONS_FORCE = 'actions/force',
  ACTIONS_RESULT = 'actions/result',
}

export enum S2C {
  ACTION = 'action',
}

export interface C2SMessage {
  command: string;
  game: string;
  data: {
    [key: string]: any;
  } | null;
}

export interface C2SMessageStartup extends C2SMessage {
  command: C2S.STARTUP;
  data: null;
}

export interface C2SMessageContext extends C2SMessage {
  command: C2S.CONTEXT;
  data: {
    message: string;
    silent: boolean;
  };
}

export interface C2SMessageActionsRegister extends C2SMessage {
  command: C2S.ACTIONS_REGISTER;
  data: {
    actions: Array<Action>;
  };
}

export interface C2SMessageActionsUnregister extends C2SMessage {
  command: C2S.ACTIONS_UNREGISTER;
  data: {
    action_names: Array<string>;
  };
}

export interface C2SMessageActionsForce extends C2SMessage {
  command: C2S.ACTIONS_FORCE;
  data: {
    state?: string;
    query: string;
    ephemeral_context?: boolean;
    action_names: string[];
  };
}

export interface C2SMessageActionsResult extends C2SMessage {
  command: C2S.ACTIONS_RESULT;
  data: {
    id: string;
    bool: boolean;
    message?: string;
  };
}

export interface S2CMessage {
  command: string;
  data: {
    [key: string]: any;
  };
}

export interface S2CMessageAction extends S2CMessage {
  command: S2C.ACTION;
  data: {
    id: string;
    name: string;
    data?: string;
  };
}
