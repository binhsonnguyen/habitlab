
(function() {

  'use strict';

  var settings = Polymer.Settings;

  Polymer.Base = {

    // Used for `isInstance` type checking; cannot use `instanceof` because
    // there is no common Polymer.Base in the prototype chain between type
    // extensions and normal custom elements
    __isPolymerInstance__: true,

    // pluggable features
    // `this` context is a prototype, not an instance
    _addFeature: function(feature) {
      this.extend(this, feature);
    },

    // `this` context is a prototype, not an instance
    registerCallback: function() {
      /*
        When lazyRegister is 'max' defer all behavior work until first element
        creation. 
        When set, a behavior cannot setup an element's `is` or 
        custom constructor via defining `factoryImpl`.
        We do call beforeRegister on the prototype to preserve
        the ability to use it in ES6. This orders the element 
        prototype's `beforeRegister` before behaviors' rather than after
        as in the normal case.
      */
      if (settings.lazyRegister === 'max') {
        if (this.beforeRegister) {
          this.beforeRegister();
        }
      } else {
        this._desugarBehaviors(); // abstract
        this._doBehavior('beforeRegister'); // abstract
      }
      this._registerFeatures();  // abstract
      if (!settings.lazyRegister) {
        this.ensureRegisterFinished();
      }
    },

    createdCallback: function() {
      if (!this.__hasRegisterFinished) {
        this._ensureRegisterFinished(this.__proto__);
      }
      Polymer.telemetry.instanceCount++;
      this.root = this;
      this._doBehavior('created'); // abstract
      this._initFeatures(); // abstract
    },

    /**
     * As an optimization, when `Polymer.Settings.lazyRegister` is set to true
     * registration tasks are deferred until the first instance of the element
     * is created. If an element should not defer registration tasks until
     * this time, `ensureRegisterFinished` may be called
     * on the element's prototype.
     */
    ensureRegisterFinished: function() {
      this._ensureRegisterFinished(this);
    },

    _ensureRegisterFinished: function(proto) {
      if (proto.__hasRegisterFinished !== proto.is || !proto.is) {
        // apply behavior's beforeRegister at first instance time
        // IFF `lazyRegister` is 'max'
        if (settings.lazyRegister === 'max') {
          proto._desugarBehaviors(); // abstract
          proto._doBehaviorOnly('beforeRegister'); // abstract
        }
        proto.__hasRegisterFinished = proto.is;
        if (proto._finishRegisterFeatures) {
          proto._finishRegisterFeatures();
        }
        // registration extension point
        proto._doBehavior('registered');
        // where prototypes are simulated (IE10), element instance
        // must be specfically fixed up.
        if (settings.usePolyfillProto && proto !== this) {
          proto.extend(this, proto);
        }
      }
    },

    // reserved for canonical behavior
    attachedCallback: function() {
      // NOTE: workaround for:
      // https://code.google.com/p/chromium/issues/detail?id=516550
      // To allow querying style/layout data in attached, we defer it
      // until we are sure rendering is ready.
      var self = this;
      Polymer.RenderStatus.whenReady(function() {
        self.isAttached = true;
        self._doBehavior('attached'); // abstract
      });
    },

    // reserved for canonical behavior
    detachedCallback: function() {
      // NOTE: duplicate attachedCallback behavior
      var self = this;
      Polymer.RenderStatus.whenReady(function() {
        self.isAttached = false;
        self._doBehavior('detached'); // abstract
      });
    },

    // reserved for canonical behavior
    attributeChangedCallback: function(name, oldValue, newValue) {
      // TODO(sorvell): consider filtering out changes to host attributes
      // note: this was barely measurable with 3 host attributes.
      this._attributeChangedImpl(name); // abstract
      this._doBehavior('attributeChanged', [name, oldValue, newValue]); // abstract
    },

    _attributeChangedImpl: function(name) {
      this._setAttributeToProperty(this, name);
    },

    /**
     * Copies own properties (including accessor descriptors) from a source
     * object to a target object.
     *
     * @method extend
     * @param {?Object} target Target object to copy properties to.
     * @param {?Object} source Source object to copy properties from.
     * @return {?Object} Target object that was passed as first argument or
     *     source object if the target was null.
     */
    extend: function(target, source) {
      if (target && source) {
        var n$ = Object.getOwnPropertyNames(source);
        for (var i=0, n; (i<n$.length) && (n=n$[i]); i++) {
          this.copyOwnProperty(n, source, target);
        }
      }
      return target || source;
    },

    /**
     * Copies props from a source object to a target object.
     *
     * Note, this method uses a simple `for...in` strategy for enumerating
     * properties.  To ensure only `ownProperties` are copied from source
     * to target and that accessor implementations are copied, use `extend`.
     *
     * @method mixin
     * @param {!Object} target Target object to copy properties to.
     * @param {?Object} source Source object to copy properties from.
     * @return {!Object} Target object that was passed as first argument.
     */
    mixin: function(target, source) {
      for (var i in source) {
        target[i] = source[i];
      }
      return target;
    },

    copyOwnProperty: function(name, source, target) {
      var pd = Object.getOwnPropertyDescriptor(source, name);
      if (pd) {
        Object.defineProperty(target, name, pd);
      }
    },

    _logger: function(level, args) {
      // accept ['foo', 'bar'] and [['foo', 'bar']]
      if (args.length === 1 && Array.isArray(args[0])) {
        args = args[0];
      }
      // only accept logging functions
      switch(level) {
        case 'log':
        case 'warn':
        case 'error':
          console[level].apply(console, args);
          break;
      }
    },
    _log: function() {
      var args = Array.prototype.slice.call(arguments, 0);
      this._logger('log', args);
    },
    _warn: function() {
      var args = Array.prototype.slice.call(arguments, 0);
      this._logger('warn', args);
    },
    _error: function() {
      var args = Array.prototype.slice.call(arguments, 0);
      this._logger('error', args);
    },
    _logf: function(/* args*/) {
      return this._logPrefix.concat(this.is).concat(Array.prototype.slice.call(arguments, 0));
    }
  };

  Polymer.Base._logPrefix = (function(){
    // only Firefox, Chrome, and Safari support colors in console logging
    var color = (window.chrome && !(/edge/i.test(navigator.userAgent))) || (/firefox/i.test(navigator.userAgent));
    return color ? ['%c[%s::%s]:', 'font-weight: bold; background-color:#EEEE00;'] : ['[%s::%s]:'];
  })();

  Polymer.Base.chainObject = function(object, inherited) {
    if (object && inherited && object !== inherited) {
      if (!Object.__proto__) {
        object = Polymer.Base.extend(Object.create(inherited), object);
      }
      object.__proto__ = inherited;
    }
    return object;
  };

  Polymer.Base = Polymer.Base.chainObject(Polymer.Base, HTMLElement.prototype);

  if (window.CustomElements) {
    Polymer.instanceof = CustomElements.instanceof;
  } else {
    Polymer.instanceof = function(obj, ctor) {
      return obj instanceof ctor;
    };
  }

  Polymer.isInstance = function(obj) {
    return Boolean(obj && obj.__isPolymerInstance__);
  };

  // TODO(sjmiles): ad hoc telemetry
  Polymer.telemetry.instanceCount = 0;

})();
