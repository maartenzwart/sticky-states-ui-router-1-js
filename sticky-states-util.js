
angular.module("sticky-states-util", [])

.constant("StickyStatesData", {
    //set of inactive path nodes
    inactives: [],

    //will broadcast map of inactive state names on $rootScope like {"inactiveStateName1", "inactiveStateName2"}
    //anyone can get them via $scope.$on(StickyStatesData.inactiveEvent, function(event, inactiveMap) { ... });
    //will be disabled if inactiveEvent is falsy
    inactiveEvent: "sticky-states-inactive"
})

//service returning function to check if state or state name is inactive
.service("StickyStateService", ["StickyStatesData", function(StickyStatesData) {
    return {
        isInactive: function(stateOrName) {
            return StickyStatesData.inactives.some(function(pathNode) {
                return pathNode && pathNode.state && pathNode.state.name===(stateOrName && stateOrName.name || stateOrName);
            });
        }
    };
}])

//provider for sticky states core functionality, which we inject into a decorator to override ui.router's transitions.create function
.provider("StickyStatesUtil", function StickyStatesUtilProvider() {
    this.$get = ["StickyStatesData", "$rootScope", function StickyStatesUtilFactory(StickyStatesData, $rootScope) {
        var SERVICE = {
            identity: function(x) { return x; },

            inArray: function(array, obj) {
                return array.indexOf(obj) !== -1;
            },

            notInArray: function(array) {
                return function(obj) {
                    return !SERVICE.inArray(array, obj);
                };
            },

            tail: function(arr) {
                return (arr.length && arr[arr.length - 1]) || undefined;
            },

            isTrue: function(elem) { return !!elem; },

            getInactive: function(pathNode) {
                var ret = StickyStatesData.inactives.filter(function(inactiveNode) { return inactiveNode.state===pathNode.state; });
                return (ret.length ? ret[0] : null);
            },

            isChildOf: function(parent) {
                return function(pathNode) {
                    return pathNode.state.parent===parent.state;
                };
            },

            isChildOfAny: function(parents) {
                return function(pathNode) {
                    return parents.map(function(parent) {
                        return SERVICE.isChildOf(parent)(pathNode);
                    }).some(SERVICE.isTrue);
                };
            },

            ancestorPath: function(state) {
                return state.parent ? SERVICE.ancestorPath(state.parent).concat(state) : [state];
            },

            isDescendantOf: function(ancestor) {
                return function(pathNode) {
                    return SERVICE.ancestorPath(pathNode.state).indexOf(ancestor.state || ancestor) !== -1;
                };
            },

            isDescendantOfAny: function(ancestors) {
                return function(pathNode) {
                    return ancestors.map(function(ancestor) {
                        return SERVICE.isDescendantOf(ancestor)(pathNode);
                    }).some(SERVICE.isTrue);
                };
            },

            pushR: function (arr, obj) {
                arr.push(obj);
                return arr;
            },

            uniqR: function (acc, token) {
                return SERVICE.inArray(acc, token) ? acc : SERVICE.pushR(acc, token);
            },

            nodeDepthThenInactivateOrder: function(inactives) {
                return function(l, r) {
                    var depthDelta = (l.state.path.length - r.state.path.length);
                    return depthDelta !== 0 ? depthDelta : inactives.indexOf(r) - inactives.indexOf(l);
                };
            },

            removeFrom: function(arr, specificProperty) {
                var compArr = specificProperty ? arr.map(function(obj) { return obj[specificProperty]; }) : arr;
                return function(obj) {
                    var compObj = specificProperty ? obj[specificProperty] : obj;
                    var index = compArr.indexOf(compObj);
                    if(index > -1) {
                        arr.splice(index, 1);
                        specificProperty && compArr.splice(index, 1);
                    }
                };
            },

            pushTo: function(arr) {
                return function(obj) {
                    arr.push(obj);
                };
            },

            isArray: function(obj) {
                return obj.constructor === Array;
            },

            assertMap: function(fun, errFun) {
                return function(obj) {
                    if(!obj) {
                        throw new Error(errFun(obj));
                    } else {
                        var ret = fun(obj);
                        if(!ret) {
                            throw new Error(errFun(obj));
                        } else {
                            return ret;
                        }
                    }
                };
            },

            findDynamic: function(param) { return param.dynamic; },

            findNodeByStateName: function(compNode) { return function(node) { return node && node.state && node.state.name===(compNode && compNode.state && compNode.state.name); }; },

            //used to drive an API to exit specific sticky states programmatically, not used for normal transitioning
            calculateExitSticky: function(treeChanges, transition) {
                //commented out: not used and not exactly sure how to populate exitSticky initially. Also seems overcomplicated --- if you want to
                //exit some inactive state, then just pass in the state list to exit, filter it down to inactives, and return those as exiting...
                /*//process the inactive states that are going to exit due to $stickyState.reset()
                var exitSticky = transition.options().exitSticky || []; //initialize exitSticky, if needed
                if (!SERVICE.isArray(exitSticky)) { //force exitSticky to array
                    exitSticky = [exitSticky];
                }
                var $state = transition.router.stateService;

                //get internal state object per exitSticky state (or state name)
                var states = exitSticky
                    .map(SERVICE.assertMap(function(stateOrName) { return $state.get(stateOrName); }, function(state) { return "State not found: " + state; }))
                    .map(function(state) { return state.$$state(); });

                //get unique list of current inactives and newly inactivating states
                var potentialExitingStickies = StickyStatesData.inactives.concat(treeChanges.inactivating).reduce(SERVICE.uniqR, []);

                //function to get inactive state from state
                var findInactive = function(state) { var ret = potentialExitingStickies.filter(function(node) { return node.state === state; }); return (ret.length ? ret[0] : null); };
                var notInactiveMsg = function(state) { return "State not inactive: " + state; }; //assert error msg

                //get inactive states from set of states we have
                var exitingInactives = states.map(SERVICE.assertMap(findInactive, notInactiveMsg));

                //only exit states that are descendants of any of the exitingInactives states
                var exiting = potentialExitingStickies.filter(SERVICE.isDescendantOfAny(exitingInactives));

                var inToPathMsg = function(node) { return "Can not exit a sticky state that is currently active/activating: " + node.state.name; }; //assert error msg
                exiting.map(SERVICE.assertMap(function(node) { return !SERVICE.inArray(treeChanges.to, node); }, inToPathMsg)); //throw errors if any exiting node is not in treeChanges.to
                return exiting;*/


                //allow caller (ie, "go" or "transitionTo" to specify a param flag to reset all inactive states
                //caller may also specify reload: true in their options to ensure the target is also reloaded
                if(transition.targetState().params() && transition.targetState().params().resetAll) {
                    //return all inactive states (meaning, all inactive states will be exited)
                    return StickyStatesData.inactives; //transition.router.stateRegistry.states;
                } else {
                    return [];
                }
            },

            calculateStickyTreeChanges: function(transition, $delegate, origCreate) {
                var targetState = transition.targetState();
                var treeChanges = transition.treeChanges();
                treeChanges.inactivating = [];
                treeChanges.reactivating = [];

                //prevent state exits; instead of exiting a sticky state, add to inactivating set. We will determine what to exit later
                //note: treeChanges arrays are ordered paths. The 0th entry of exiting means: "first state exited", and the last entry means: "last state exited"
                if (treeChanges.entering.length && treeChanges.exiting[0] && treeChanges.exiting[0].state.sticky) {
                    treeChanges.inactivating = treeChanges.exiting;
                    treeChanges.exiting = [];
                }

                //retained states + entering states that were previously inactive
                var inactiveFromPath = treeChanges.retained.concat(treeChanges.entering.map(function(node) {
                    return SERVICE.getInactive(node);
                })).filter(SERVICE.identity); //identity used just to force a copied array

                //simulate tree changes from inactiveFromPath to targetState
                //this will expose all param changes, indicating to us what we really need to exit
                var simulatedTransition = origCreate.apply($delegate, [inactiveFromPath, targetState]);
                var simulatedTreeChanges = simulatedTransition.treeChanges();

                //this is the original transition delegate, and we run under its context to get simulatedTreeChanges,
                //meaning the transition we return is missing its on* events and the simulated transition has them
                //on enter of the delegate, we add any on* events back to the transition we were passed
                //(and whose tree changes we return)
                $delegate.onEnter({}, function() { //must use delegate onEnter bc it is too late after running the sim trans
                    ["onSuccess","onBefore","onEnter","onRetain","onStart","onFinish","onExit","onError"].forEach(function(hookEvent) {
                        var hooks = simulatedTransition.getHooks(hookEvent); //simulated transition has the original hooks
                        hooks && hooks.length && hooks.forEach(function(hook) {
                            if(hook && !hook._deregistered && hook.callback) {
                                //add hook to transition
                                transition[hookEvent](hook.matchCriteria, hook.callback, {priority: hook.priority, bind: hook.bind});
                            }
                        });
                    });
                });

                //if there are any retained or entering or exiting nodes in the simulation, we need to rewrite paths
                var shouldRewritePaths = ["retained", "entering", "exiting"].some(function(path) { return !!simulatedTreeChanges[path].length; });

                if(shouldRewritePaths) {
                    //the retained nodes from the simulated transition will be reactivated.
                    //(excluding the nodes that are in the original retained path)
                    //eg, if 10 simulated retained (0, 1,...,9) and 3 original retained (0, 1, 2), then set reactivating to indexes 3 to 9 (0-based index)
                    //thus: simulated retained must be a superset of original retained
                    treeChanges.reactivating = [];
                    for(var i= treeChanges.retained.length, len = simulatedTreeChanges.retained.length; i<len; i++) {
                        var simRetNode = simulatedTreeChanges.retained[i]; //candidate simulated retained node to add to reactivating list
                        if(simRetNode) { //ensure the node is defined
                            if(simRetNode.paramSchema.filter(SERVICE.findDynamic).length) { //if the node has dynamic params, we need special handling!
                                var simToNodeArr = simulatedTreeChanges.to.filter(SERVICE.findNodeByStateName(simRetNode)); //get the simulated TO node for the same simRetNode state
                                if(simToNodeArr.length) { //if to TO node exists...
                                    treeChanges.reactivating.push(simToNodeArr[0]); //use it instead of the simulated retained node (this means we keep new parameters)
                                }
                            } else {
                                treeChanges.reactivating.push(simRetNode); //else continue as usual
                            }
                        }
                    }

                    treeChanges.entering.map(function() {
                        treeChanges.to.pop(); //entering are last elements in "to"-list, remove these from the old "to"-list
                    });

                    //entering nodes are the same as the simulation's entering
                    treeChanges.entering = simulatedTreeChanges.entering;

                    //the simulation's exiting nodes are inactives that are being exited because:
                    // * the inactive state params changed
                    // * the inactive state is being reloaded
                    // * the inactive state is a child of the to-state
                    treeChanges.exiting = treeChanges.exiting.concat(simulatedTreeChanges.exiting);

                    //rewrite the to path
                    //NOTE: commented out bc it breaks dynamic states: treeChanges.to = treeChanges.retained.concat(treeChanges.reactivating).concat(treeChanges.entering);
                    treeChanges.reactivating.concat(treeChanges.entering).forEach(function(pathNode) {
                        treeChanges.to.push(pathNode); //add, in this order, the reactivated elements, then the new entering elements to the list
                    });
                }

                //determine which inactive states should be exited

                //tail(treeChanges.to) is the last entry in the to-path. This means it is the final destination of the transition.
                //childrenOfToState is therefore any inactive states that are children of the final destination state
                var childrenOfToState = StickyStatesData.inactives
                    .filter(SERVICE.isChildOf(SERVICE.tail(treeChanges.to)));

                //get inactive children of any state in the transition to-path.
                //exclude children that are in the to-path itself and sticky children
                var childrenOfToPath = StickyStatesData.inactives
                    .filter(SERVICE.isChildOfAny(treeChanges.to))
                    .filter(SERVICE.notInArray(treeChanges.to))
                    .filter(function(node) { return !node.state.sticky; });

                //but what if a sticky child is inactive and the current state is an active sibling
                //then the active sibling is reloaded with different params and this the active sibling is reloaded
                //then the inactive sticky sibling of the current one is not exited bc it is sticky! Worse, it is
                //removed from the inactive list and thus we have two states present at once
                //Instead, we use entering. If there are inactive states that are children of states being entered (ie, freshly loaded, NOT retained)
                //then we should exit these states even if they are sticky...
                var childrenOfEnteringPath = StickyStatesData.inactives
                    .filter(SERVICE.isChildOfAny(treeChanges.entering));

                //exitingChildren are the children above, excluding any already in the exiting set
                var exitingChildren = childrenOfToState
                    .concat(childrenOfToPath, childrenOfEnteringPath)
                    .filter(SERVICE.notInArray(treeChanges.exiting));

                //get list of all exiting
                var exitingRoots = treeChanges.exiting.concat(exitingChildren);

                //any inactive descendant of an exiting state will be exited
                var orphans = StickyStatesData.inactives
                    .filter(SERVICE.isDescendantOfAny(exitingRoots)) //inactives with exiting ancestor
                    .filter(SERVICE.notInArray(exitingRoots)) //not already in exiting list
                    .concat(exitingChildren) //concat with exiting children
                    .reduce(SERVICE.uniqR, []) //form unique array
                    .sort(SERVICE.nodeDepthThenInactivateOrder(StickyStatesData.inactives)); //sort by node depth and inactivation order

                //set new exiting array
                treeChanges.exiting = orphans.concat(treeChanges.exiting);

                transition.onSuccess({}, function() {
                    treeChanges.exiting.forEach(SERVICE.removeFrom(StickyStatesData.inactives));
                    treeChanges.entering.forEach(SERVICE.removeFrom(StickyStatesData.inactives));
                    treeChanges.reactivating.forEach(SERVICE.removeFrom(StickyStatesData.inactives, "state")); //required since we mix simulated TO and simulated RETAINED into reactivating
                    treeChanges.inactivating.forEach(SERVICE.pushTo(StickyStatesData.inactives));

                    if(StickyStatesData.inactiveEvent) {
                        var inactiveMap = {};
                        StickyStatesData.inactives.forEach(function(pathNode) {
                            if(pathNode && pathNode.state && pathNode.state.name) {
                                inactiveMap[pathNode.state.name] = true;
                            }
                        });
                        $rootScope.$broadcast(StickyStatesData.inactiveEvent, inactiveMap);
                    }
                });

                //process the inactive sticky states that should be exited
                var exitSticky = SERVICE.calculateExitSticky(treeChanges, transition);
                exitSticky.filter(SERVICE.notInArray(treeChanges.exiting)).forEach(SERVICE.pushTo(treeChanges.exiting));
                exitSticky.filter(function(node) {
                    return SERVICE.inArray(treeChanges.inactivating, node);
                }).forEach(SERVICE.removeFrom(treeChanges.inactivating));

                //if inactivating the same state as entering, but with different params, we should exit
                for(var i=treeChanges.inactivating.length - 1; i >= 0; i--) {
                    for(var j=treeChanges.entering.length - 1; j >= 0; j--) {
                        var pathNodeI = treeChanges.inactivating[i];
                        var pathNodeE = treeChanges.entering[j];
                        if(pathNodeI && pathNodeE && pathNodeI.state && pathNodeE.state && pathNodeE.state===pathNodeI.state && pathNodeE !== pathNodeI) { //state is same but nodes differ
                            treeChanges.exiting.push(pathNodeI); //exit the inactive state to prevent entered state from being inactive
                            treeChanges.inactivating.splice(i, 1); //remove state from inactive list
                        }
                    }
                }

                return treeChanges;
            }
        };
        return SERVICE;
    }];
});
