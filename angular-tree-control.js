(function ( angular ) {
  'use strict';

  angular.module( 'treeControl', [] )
    .directive( 'treecontrol', ['$compile', function( $compile, $timeout ) {
      /**
       * @param cssClass - the css class
       * @param addClassProperty - should we wrap the class name with class=""
       */
      function classIfDefined(cssClass, addClassProperty) {
        if (cssClass) {
          if (addClassProperty)
            return 'class="' + cssClass + '"';
          else
            return cssClass;
        }
        else
          return "";
      }

      function ensureDefault(obj, prop, value) {
        if (!obj.hasOwnProperty(prop))
          obj[prop] = value;
      }

      return {
        restrict: 'E',
        require: "treecontrol",
        transclude: true,
        scope: {
          treeModel: "=",
          searchString: '=',
          selectedNode: "=?",
          expandedNodes: "=?",
          onSelection: "&",
          onNodeToggle: "&",
          treeFunctions: "=",
          options: "=?",
          orderBy: "@",
          reverseOrder: "@",
          filterExpression: "=?",
          filterComparator: "=?",
          nodeRenameCallback: "=",

          contextMenuNode: "=",
          contextMenuName: '=',
          isLumxDropdown: '&'
        },
        controller: ['$scope', '$attrs', '$element', function( $scope, $attrs, $element ) {

          $scope.myMenuFunctions = {};

          // Hides all nodes who don't have 'qry' in their names
          // (or in one of their children)
          // If qry is '', sets everything to visible.
          function filterTreeR(node, qry) {
            if (!node) {
              return false;
            }

            var showKid = false;

            if (node.children && node.children.length > 0) {
              for (var i = 0; i < node.children.length; ++i) {
                if (filterTreeR(node.children[i], qry)) {
                  showKid = true;
                }
              }
            }

            if (qry === '' || showKid || node.name.indexOf(qry) > -1) {
              node._isHidden = false;
            }
            else {
              node._isHidden = true;
            }

            return !node._isHidden;
          }

          function filterTree() {
            var qry = $scope.searchString;

            if (qry !== undefined && typeof qry === 'string') {
              filterTreeR($scope.treeModel, qry);
            }
          }

          $scope.$watch('searchString', function() {
            filterTree();
          });

          function defaultIsLeaf(node) {
            return node._isLeaf;
          }

          function defaultIsHidden(node) {
            return node._isHidden;
          }

          function defaultEquality(a, b) {
            if (a === undefined || b === undefined)
              return false;
            a = angular.copy(a);
            a[$scope.options.nodeChildren] = [];
            b = angular.copy(b);
            b[$scope.options.nodeChildren] = [];
            return angular.equals(a, b);
          }

          $scope.contextMenuShow = function(node) {
            $scope.contextMenuNode = node;
          };

          $scope.options = $scope.options || {};
          ensureDefault($scope.options, "nodeChildren", "children");
          ensureDefault($scope.options, "dirSelectable", "true");
          ensureDefault($scope.options, "injectClasses", {});
          ensureDefault($scope.options.injectClasses, "ul", "");
          ensureDefault($scope.options.injectClasses, "li", "");
          ensureDefault($scope.options.injectClasses, "liHidden", "hidden");
          ensureDefault($scope.options.injectClasses, "liSelected", "");
          ensureDefault($scope.options.injectClasses, "iExpanded", "");
          ensureDefault($scope.options.injectClasses, "iCollapsed", "");
          ensureDefault($scope.options.injectClasses, "iLeaf", "");
          ensureDefault($scope.options.injectClasses, "label", "");
          ensureDefault($scope.options.injectClasses, "labelSelected", "");
          ensureDefault($scope.options, "equality", defaultEquality);
          ensureDefault($scope.options, "isLeaf", defaultIsLeaf);
          ensureDefault($scope.options, 'isHidden', defaultIsHidden);

          $scope.expandedNodes = $scope.expandedNodes || [];
          $scope.expandedNodesMap = {};
          for (var i=0; i < $scope.expandedNodes.length; i++) {
            $scope.expandedNodesMap[""+i] = $scope.expandedNodes[i];
          }
          $scope.parentScopeOfTree = $scope.$parent;

          $scope.liHiddenClass = function(node) {
            var liHiddenClass = classIfDefined(
              $scope.options.injectClasses.liHidden,
              false
            );

            if ($scope.options.isHidden(node)) {
              return liHiddenClass;
            }

            return '';
          };

          $scope.headClass = function(node) {
            var liSelectionClass = classIfDefined($scope.options.injectClasses.liSelected, false);
            var injectSelectionClass = "";

            var hiddenClass = $scope.liHiddenClass(node);

            if(hiddenClass !== '') {
              return hiddenClass; // If it's hidden, nothing else matters
            }

            if (liSelectionClass && ($scope.options.equality(this.node, $scope.selectedNode)))
              injectSelectionClass = " " + liSelectionClass;
            if ($scope.options.isLeaf(node))
              return "tree-leaf" + injectSelectionClass;
            if ($scope.expandedNodesMap[this.$id])
              return "tree-expanded" + injectSelectionClass;
            else
              return "tree-collapsed" + injectSelectionClass;
          };

          $scope.iBranchClass = function() {
            if ($scope.expandedNodesMap[this.$id])
              return classIfDefined($scope.options.injectClasses.iExpanded);
            else
              return classIfDefined($scope.options.injectClasses.iCollapsed);
          };

          $scope.nodeExpanded = function() {
            return !!$scope.expandedNodesMap[this.$id];
          };

          $scope.selectNodeHead = function() {
            var expanding = $scope.expandedNodesMap[this.$id] === undefined;
            $scope.expandedNodesMap[this.$id] = (expanding ? this.node : undefined);
            if (expanding) {
              $scope.expandedNodes.push(this.node);
            }
            else {
              var index;
              for (var i=0; (i < $scope.expandedNodes.length) && !index; i++) {
                if ($scope.options.equality($scope.expandedNodes[i], this.node)) {
                  index = i;
                }
              }
              if (index != undefined)
                $scope.expandedNodes.splice(index, 1);
            }
            if ($scope.onNodeToggle)
              $scope.onNodeToggle({node: this.node, expanded: expanding});
          };

          $scope.selectNodeLabel = function( selectedNode, $event ){
            if (selectedNode[$scope.options.nodeChildren] && selectedNode[$scope.options.nodeChildren].length > 0 &&
              !$scope.options.dirSelectable) {
              this.selectNodeHead();
            }
            else {
              if ($scope.selectedNode != selectedNode) {
                $scope.selectedNode = selectedNode;
              }
              else {
                // $scope.selectedNode = undefined;
                // If they're selecting the already-selected node, pop open
                // the context menu.
                if (selectedNode.contextMenuFunctions) {
                  $scope.contextMenuShow(selectedNode);
                  selectedNode.contextMenuFunctions.openOn($event.target);
                  $event.preventDefault();
                  $event.stopPropagation();
                }
                else {
                  console.warn('contextMenuFunctions not set up correctly');
                }
              }
              if ($scope.onSelection) {
                $scope.onSelection({node: $scope.selectedNode});
              }
            }
          };

          // Scan down tree and make sure that everything is expanded
          $scope.treeFunctions.selectNodeLabel = function(nodeName, parentNode, chain) {
            parentNode = parentNode || $scope.treeModel;
            var topLevel = chain === undefined;
            chain = chain || [];
            for (var i = 0; i < parentNode.children.length; ++i) {
              var testNode = parentNode.children[i];
              if (testNode.path == nodeName) {
                // FOUND IT
                chain.push(testNode);
                return true;
              }
              if ($scope.treeFunctions.selectNodeLabel(nodeName, testNode, chain)) {
                // Select self
                chain.push(testNode);
                if (topLevel && chain.length) {
                  for (var i = chain.length - 1; i >= 0; i--) {
                    $scope.selectNodeHead(chain[i]);
                    $scope.selectNodeLabel(chain[i]);
                  }
                }
                return true;
              }
            }
            return false;
          };

          $scope.treeFunctions.clearSelected = function() {
            $scope.selectedNode = undefined;
          };

          $scope.selectedClass = function() {
            var labelSelectionClass = classIfDefined($scope.options.injectClasses.labelSelected, false);
            var injectSelectionClass = "";
            if (labelSelectionClass && (this.node == $scope.selectedNode))
              injectSelectionClass = " " + labelSelectionClass;

            return (this.node == $scope.selectedNode)?"tree-selected" + injectSelectionClass:"";
          };

          var isLumxDropdown = $attrs.isLumxDropdown === 'true';
          //tree template
          var template =
            '<ul '+classIfDefined($scope.options.injectClasses.ul, true)+'>' +
              '<li context-menu="contextMenuShow(node)" is-lumx-dropdown="' + isLumxDropdown + '"'
                + 'data-target="explorer-context-menu" '
                + 'ng-repeat="node in node.' + $scope.options.nodeChildren
                + ' | filter:filterExpression:filterComparator'
                + ' | orderBy:orderBy:reverseOrder" '
                + 'ng-class="headClass(node)" '
                + classIfDefined($scope.options.injectClasses.li, true) + ' '
                + 'context-menu-tree-node="node" '
                +'>' +
                '<i class="tree-branch-head" ng-class="iBranchClass()" ng-click="!node._editable && selectNodeHead(node)"></i>' +
                '<i class="tree-leaf-head '+classIfDefined($scope.options.injectClasses.iLeaf, false)+'"></i>' +
                '<div class="tree-label '+classIfDefined($scope.options.injectClasses.label, false)+'" ng-class="selectedClass()" ng-click="!node._editable && selectNodeLabel(node, $event)" tree-transclude></div>' +
                '<treeitem ng-if="nodeExpanded()"></treeitem>' +
              '</li>' +
            '</ul>';

          this.template = $compile(template);
        }],
        compile: function(element, attrs, childTranscludeFn) {
          // return linking function
          return function ( scope, element, attrs, treemodelCntr ) {

            var trimSlashes = function(s) {
              var i;
              while ((i = s.indexOf('/')) === 0  && s.length) {
                s = s.substring(i + 1, s.length);
              }
              while ((i =  s.lastIndexOf('/')) === s.length - 1 && s.length) {
                s = s.substring(0, i);
              }
              return s;
            };

            var addNode = function(root, initialPath, isLeaf) {
              var nodeName = extractName(initialPath);
              var obj = {
                name: nodeName,
                path: initialPath,
                children: [],
                _editable: false,
                _oldName: '',
                _isLeaf: isLeaf,
                _isHidden: false,
                _setEditable: function(flag) {
                  if (flag) {
                    obj._oldName = obj.name;
                  }
                  obj._editable = flag;
                  obj._setEditableCallback && obj._setEditableCallback();
                },
                _setEditableCallback: null,
                _rename: function(newName) {
                  if (!newName || !newName.length) {
                    obj.name = obj._oldName;
                  } else {
                    obj.name = newName;

                    // Need to update path with new name
                    var lastSlash = obj.path.lastIndexOf('/');
                    var old_path = obj.path;
                    if (lastSlash >= 0) {
                      obj.path = obj.path.substring(0, lastSlash) + '/' + obj.name
                    } else {
                      // No slashes found, must be a top-level node.
                      obj.path = obj.name;
                    }

                    scope.nodeRenameCallback && scope.nodeRenameCallback(obj, old_path);
                  }
                  obj._setEditable(false);
                  return obj.name;
                }
              };
              root.children.push(obj);
              return obj;
            };

            var findParent =
              function(
                initialPath,
                parentNode,
                currentPathIndex) {
              parentNode = parentNode || scope.treeModel;
              currentPathIndex = currentPathIndex || 0;

              initialPath = trimSlashes(initialPath);

              var currentPath = initialPath.substring(currentPathIndex,
                initialPath.length);
              currentPath = currentPath;
              var lastSlash = currentPath.lastIndexOf('/');
              if (lastSlash < 0) {
                // Final case
                return parentNode;
              } else {
                // Recursive case
                var firstSlash = currentPathIndex
                  + initialPath.substring(currentPathIndex).indexOf('/');
                var nextParentName = initialPath.substring(currentPathIndex,
                  firstSlash);

                // Make sure the next directory down exists
                var nextParent = null;
                for (var i = 0; i < parentNode.children.length; ++i) {
                  var nextParentTest = parentNode.children[i];
                  if (nextParentTest.name == nextParentName) {
                    nextParent = nextParentTest;
                    break;
                  }
                }
                if (!nextParent) {
                  var tempPath = initialPath.substring(0, firstSlash);
                  nextParent = addNode(parentNode, tempPath, false);
                }

                return findParent(
                  initialPath,
                  nextParent,
                  firstSlash + 1);
              }
            };

            var extractName = function(initialPath) {
              var lastSlash = initialPath.lastIndexOf('/');
              var nodeName = initialPath;

              if (lastSlash >= 0) {
                nodeName = initialPath.substring(lastSlash+1);
              }

              return nodeName;
            };

            var extractPrefix = function(initialPath) {
              var lastSlash = initialPath.lastIndexOf('/');
              var prefix = '';

              if (lastSlash >= 0) {
                prefix = initialPath.substring(0, lastSlash+1);
              }
              return prefix;
            };

            scope.treeFunctions.deleteFromTree = function(initialPath) {

              var nodeName = extractName(initialPath);
              var prefix = extractPrefix(initialPath);
              var parent = null;

              if (prefix !== '') {
                parent = findParent(initialPath);
              } else {
                // No path, must be top-level node
                parent = scope.treeModel;
              }

              for (var i = 0; i < parent.children.length; ++i) {
                if(parent.children[i].name === nodeName) {
                  parent.children.splice(i, 1);
                  return;
                }
              }
            };

            scope.treeFunctions.addToTree = function(initialPath, isLeaf) {
              var parentNode = findParent(initialPath);
              var nodeName = extractName(initialPath);

              var found = false;
              for (var i = 0; i < scope.expandedNodes.length; ++i) {
                if (scope.expandedNodes[i] === parentNode) {
                  found = true;
                }
              }
              if (!found) {
                scope.expandedNodes.push(parentNode);
              }

              return addNode(parentNode, initialPath, isLeaf);
            };

            scope.$watch("treeModel",
              function updateNodeOnRootScope(newValue, oldValue) {
              if (angular.isArray(newValue)) {
                if (angular.isDefined(scope.node)
                  && angular.equals(scope.node[scope.options.nodeChildren],
                    newValue)) {
                  return;
                }
                scope.node = {};
                scope.synteticRoot = scope.node;
                scope.node[scope.options.nodeChildren] = newValue;
              }
              else {
                if (angular.equals(scope.node, newValue))
                  return;
                scope.node = newValue;
              }
            });

            scope.$watchCollection('expandedNodes', function(newValue) {
              var notFoundIds = 0;
              var newExpandedNodesMap = {};
              var $liElements = element.find('li');
              var existingScopes = [];
              // find all nodes visible on the tree and the scope $id of the
              // scopes including them
              angular.forEach($liElements, function(liElement) {
                var $liElement = angular.element(liElement);
                var liScope = $liElement.scope();
                existingScopes.push(liScope);
              });
              // iterate over the newValue, the new expanded nodes, and for each
              // find it in the existingNodesAndScopes
              // if found, add the mapping $id -> node into newExpandedNodesMap
              // if not found, add the mapping num -> node into
              // newExpandedNodesMap
              angular.forEach(newValue, function(newExNode) {
                var found = false;
                for (var i=0; (i < existingScopes.length) && !found; i++) {
                  var existingScope = existingScopes[i];
                  if (scope.options.equality(newExNode, existingScope.node)) {
                    newExpandedNodesMap[existingScope.$id] = existingScope.node;
                    found = true;
                  }
                }
                if (!found)
                  newExpandedNodesMap[notFoundIds++] = newExNode;
              });
              scope.expandedNodesMap = newExpandedNodesMap;
            });

            //Rendering template for a root node
            treemodelCntr.template( scope, function(clone) {
              element.html('').append( clone );
            });
            // save the transclude function from compile (which is not bound to
            // a scope as apposed to the one from link)
            // we can fix this to work with the link transclude function with
            // angular 1.2.6. as for angular 1.2.0 we need
            // to keep using the compile function
            scope.$treeTransclude = childTranscludeFn;
          }
        }
      };
    }])
    .directive("treeitem", function() {
      return {
        restrict: 'E',
        require: "^treecontrol",
        link: function( scope, element, attrs, treemodelCntr) {
          // Rendering template for the current node
          treemodelCntr.template(scope, function(clone) {
            element.html('').append(clone);
          });
        }
      }
    })
    .directive("treeTransclude", function() {
      return {
        link: function(scope, element, attrs, controller) {
          if (!scope.options.isLeaf(scope.node)) {
            angular.forEach(scope.expandedNodesMap, function (node, id) {
              if (scope.options.equality(node, scope.node)) {
                scope.expandedNodesMap[scope.$id] = scope.node;
                scope.expandedNodesMap[id] = undefined;
              }
            });
          }
          if (scope.options.equality(scope.node, scope.selectedNode)) {
            scope.selectedNode = scope.node;
          }

          // create a scope for the transclusion, whos parent is the parent of
          // the tree control
          scope.transcludeScope = scope.parentScopeOfTree.$new();
          scope.transcludeScope.node = scope.node;
          scope.transcludeScope.$parentNode =
            (scope.$parent.node === scope.synteticRoot)
              ? null
              : scope.$parent.node;
          scope.transcludeScope.$index = scope.$index;
          scope.transcludeScope.$first = scope.$first;
          scope.transcludeScope.$middle = scope.$middle;
          scope.transcludeScope.$last = scope.$last;
          scope.transcludeScope.$odd = scope.$odd;
          scope.transcludeScope.$even = scope.$even;
          scope.$on('$destroy', function() {
            scope.transcludeScope.$destroy();
          });

          scope.$treeTransclude(scope.transcludeScope, function(clone) {
            element.empty();
            element.append(clone);
          });
        }
      }
    })
    .directive('editableTreeNode', function ($timeout) {
      return {
      restrict: 'E',
      scope: {
        ngModel: '='
      },
      link: function (scope, element, attrs) {
        // Add callbacks to the node
        var node = scope.ngModel;
        var target = element[0];

        node._setEditableCallback = function() {
          $timeout(function(){ target.focus(); });
        };

        var doRename = function(useNewValue) {
          scope.$apply(function (){
            target.innerHTML = scope.ngModel._rename(useNewValue
              ? target.innerHTML
              : undefined);
          });
        };

        element.bind('blur', function() {
          if (node._editable) {
            doRename(true);
          }
        });

        element.bind("keydown keypress", function (event) {
        if(event.which === 13) {
          doRename(true);
          event.preventDefault();
        }
        });

        element.bind("keydown keypress", function (event) {
        if(event.which === 27) {
          doRename(false);
          event.preventDefault();
        }
        });
      }
      }
    });
})( angular );
