
var BrowserTabManager = function( parentObj ) {

  OPromise.call( this );

  // Set up 0 mock BrowserTab objects at startup
  this.length = 0;

  this._lastFocusedTab = null;

  this._parent = parentObj;

  // Remove all collection items and replace with browserTabs
  this.replaceTabs = function( browserTabs ) {

    for( var i = 0, l = this.length; i < l; i++ ) {
      delete this[ i ];
    }
    this.length = 0;

    for( var i = 0, l = browserTabs.length; i < l; i++ ) {
      if(this !== OEX.tabs) {
        browserTabs[ i ].properties.index = i;
      }
      this[ i ] = browserTabs[ i ];
    }
    this.length = browserTabs.length;
  };

  // Add an array of browserTabs to the current collection
  this.addTabs = function( browserTabs, startPosition ) {
    // Extract current set of tabs in collection
    var allTabs = [];
    for(var i = 0, l = this.length; i < l; i++) {
      allTabs[ i ] = this[ i ];
    }
    
    var position = startPosition !== undefined ? startPosition : allTabs.length - 1;
    
    // Add new browserTabs to allTabs array
    var spliceArgs = [this !== OEX.tabs ? position : this.length, 0].concat( browserTabs );
    Array.prototype.splice.apply(allTabs, spliceArgs);

    // Rewrite the current tabs collection in order
    for( var i = 0, l = allTabs.length; i < l; i++ ) {
      if(this !== OEX.tabs) {
        // Update all tab indexes to the current tabs collection order
        allTabs[ i ].properties.index = i;
      }
      this[ i ] = allTabs[ i ];
    }
    this.length = allTabs.length;
    
  };

  // Remove a browserTab from the current collection
  this.removeTab = function( browserTab ) {
    
    var oldCollectionLength = this.length;
    
    // Extract current set of tabs in collection
    var allTabs = [];
    var removeTabIndex = -1;
    for(var i = 0, l = this.length; i < l; i++) {
      allTabs[ i ] = this[ i ];
      if( allTabs[ i ].id == browserTab.id ) {
        removeTabIndex = i;
      }
    }

    // Remove browser tab
    if(removeTabIndex > -1) {
      allTabs.splice(removeTabIndex, 1);
    }

    // Detach _windowParent from removed tab
    browserTab._windowParent = null;

    // Rewrite the current tabs collection
    for( var i = 0, l = allTabs.length; i < l; i++ ) {
      if(this !== OEX.tabs) {
        allTabs[ i ].properties.index = i;
      }
      this[ i ] = allTabs[ i ];
    }
    this.length = allTabs.length;
    
    // Remove any ghost items, if any
    if(oldCollectionLength > this.length) {
      for(var i = this.length, l = oldCollectionLength; i < l; i++) {
        delete this[ i ];
      }
    }
    
  };

};

BrowserTabManager.prototype = Object.create( OPromise.prototype );

BrowserTabManager.prototype.create = function( browserTabProperties, before ) {

  if(before && !before instanceof BrowserTab) {
    throw {
        name:        "TYPE_MISMATCH_ERR",
        message:     "Could not create BrowserTab object with invalid before attribute provided"
    };
  }

  browserTabProperties = browserTabProperties || {};

  // Parameter mappings
  if(browserTabProperties.focused !== undefined) {
    browserTabProperties.active = !!browserTabProperties.focused;
    // Not allowed in Chromium API
    delete browserTabProperties.focused;
  } else {
    // Explicitly set active to false by default in Opera implementation
    browserTabProperties.active = false;
  }
  
  if(browserTabProperties.locked !== undefined) {
    browserTabProperties.pinned = !!browserTabProperties.locked;
    delete browserTabProperties.locked;
  }
  
  // TODO handle private tab insertion differently in Chromium
  //browserTabProperties.incognito = browserTabProperties.private || false;
  
  delete browserTabProperties.closed;

  // Set parent window to create the tab in

  if(this._parent && this._parent.closed === true ) {
    throw {
        name:        "Invalid State Error",
        message:     "Parent window is in the closed state and therefore is invalid"
    };
  }
  
  var shadowBrowserTab = new BrowserTab( Object.create(browserTabProperties), this._parent || OEX.windows.getLastFocused() );
  
  // no windowId will default to adding the tab to the current window
  browserTabProperties.windowId = this._parent ? this._parent.properties.id : OEX.windows.getLastFocused().properties.id;

  // Set insert position for the new tab from 'before' attribute, if any
  if( before && before instanceof BrowserTab ) {

    if( before.closed === true ) {
      throw {
          name:        "Invalid State Error",
          message:     "'before' attribute is in the closed state and therefore is invalid"
      };
    }

    if(before._windowParent && before._windowParent.closed === true ) {
      throw {
          name:        "Invalid State Error",
          message:     "Parent window of 'before' attribute is in the closed state and therefore is invalid"
      };
    }
    browserTabProperties.windowId = before._windowParent ?
                                      before._windowParent.properties.id : browserTabProperties.windowId;
    browserTabProperties.index = before.position;

  }
  
  // Set up tab's BrowserWindow parent
  shadowBrowserTab._windowParent = this._parent || OEX.windows.getLastFocused();
  
  // Set up tab index on start
  shadowBrowserTab.properties.index = browserTabProperties.index || this !== OEX.tabs ? this.length : OEX.windows.getLastFocused().tabs.length;
  
  // Add this object to the end of the current tabs collection
  this.addTabs([ shadowBrowserTab ]);

  // Add this object to the root tab manager (if this is not the root tab manager)
  if(this !== OEX.tabs) {
    OEX.tabs.addTabs([ shadowBrowserTab ]);
  }
  
  delete browserTabProperties.closed;

  // Queue platform action or fire immediately if this object is resolved
  this.enqueue( chrome.tabs.create, browserTabProperties, function( _tab ) {

      // Update BrowserTab properties
      for(var i in _tab) {
        shadowBrowserTab.properties[i] = _tab[i];
      }
    
      // Move this object to the correct position within the current tabs collection
      // (but don't worry about doing this for the global tabs manager)
      // TODO check if this is the correct behavior here
      if(this !== OEX.tabs) {
        this.removeTab( shadowBrowserTab );
        this.addTabs([ shadowBrowserTab ], shadowBrowserTab.properties.index);
      }

      // Resolve new tab, if it hasn't been resolved already
      shadowBrowserTab.resolve(true);

      // Dispatch oncreate event to all attached event listeners
      this.dispatchEvent( new OEvent('create', {
          "tab": shadowBrowserTab,
          "prevWindow": shadowBrowserTab._windowParent, // same as current window
          "prevTabGroup": null,
          "prevPosition": NaN
      }) );

      this.dequeue();

  }.bind(this));

  return shadowBrowserTab;

};

BrowserTabManager.prototype.getAll = function() {

  var allTabs = [];

  for(var i = 0, l = this.length; i < l; i++) {
    allTabs[ i ] = this[ i ];
  }

  return allTabs;

};

BrowserTabManager.prototype.getSelected = function() {

  return this._lastFocusedTab || this[ 0 ];

};
// Alias of .getSelected()
BrowserTabManager.prototype.getFocused = BrowserTabManager.prototype.getSelected;

BrowserTabManager.prototype.close = function( browserTab ) {

  if( !browserTab || !browserTab instanceof BrowserTab) {
    throw {
            name:        "TYPE_MISMATCH_ERR",
            message:     "Expected BrowserTab object"
    };
  }
  
  browserTab.close();

};