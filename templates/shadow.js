/*
 * Shadow mounter, will got injected to the end of body
 */

require.config({
  paths: {
    json: 'https://cdnjs.cloudflare.com/ajax/libs/requirejs-plugins/1.0.3/json.min',
    text: 'https://cdnjs.cloudflare.com/ajax/libs/require-text/2.0.12/text.min',
    css: 'https://cdnjs.cloudflare.com/ajax/libs/require-css/0.1.8/css.min',
    URI: 'https://cdnjs.cloudflare.com/ajax/libs/URI.js/1.17.1/URI',
    punycode: 'https://cdnjs.cloudflare.com/ajax/libs/URI.js/1.17.1/punycode',
    IPv6: 'https://cdnjs.cloudflare.com/ajax/libs/URI.js/1.17.1/IPv6',
    SecondLevelDomains: 'https://cdnjs.cloudflare.com/ajax/libs/URI.js/1.17.1/SecondLevelDomains'
  }
});

require(['json!/app/appconfig.json'], function(appConfig) {
  if (appConfig.loader.schema.toLowerCase() === 'http://apps.d2l.com/uiapps/umdschema/v1.json') {
    require(['json!/app/appconfig.json', 'json!/.standalone/standalone.json', '/.standalone/templates/common.js', 'URI'], function(appConfig, config, common, URI) {
      var jsFiles = common.resolveMultiConfig(config.shadowJS).map(function(jsFile) {
        if (URI(jsFile).is('relative')) {
          return '/.standalone/' + jsFile;
        }
        return jsFile;
      });

      var mountElement = document.querySelector(config.shadowMountSelector);

      require(jsFiles, function() {
        require([appConfig.loader.endpoint], function(install) {
          if (typeof config.appOptions === 'string') {
            require(['json!/.standalone/' + config.appOptions], function(appOptions) {
              install(
                mountElement,
                appOptions,
                false,
                null
              );
            })
          } else {
            install(
              mountElement,
              config.appOptions,
              false,
              null
            );
          }
        });
      });
    });
  } else {
    alert('No iframe support yet :P');
  }
});