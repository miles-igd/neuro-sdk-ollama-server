# Behaviour

**'startup'**: The LLM is told that a new game has started.
**'context'**: The context message is added to the LLM context. It does not respond to messages yet.
**'actions/register'**: The action(s) are registered to the actions map.
**'actions/unregister'**: The action names are unregistered from the actions map.
**'actions/force'**: The LLM is prompted to make an action as soon as possible.
**'actions/result'**: The result of an action is assigned to the action results map.

The LLM is prompted periodically. `periodicTimeoutTime` in the config controls how long between each prompts. The periodic prompt asks the LLM to do an action, if there are no actions the prompting or if it is already responding to a prompt it is skipped.

