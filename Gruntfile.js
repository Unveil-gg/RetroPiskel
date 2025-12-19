module.exports = function (grunt) {

  // Update this variable if you don't want or can't serve on localhost
  var hostname = 'localhost';

  var PORT = {
    PROD: 9001,
    DEV: 9901,
    TEST: 9991
  };

  // create a version based on the build timestamp
  var dateFormat = require('dateformat');
  var version = '-' + dateFormat(new Date(), "yyyy-mm-dd-hh-MM");
  var releaseVersion = require('./package.json').version;

  /**
   * Helper to prefix all strings in provided array with the provided path
   */
  var prefixPaths = function (paths, prefix) {
    return paths.map(function (path) {
      return prefix + path;
    });
  };

  // get the list of scripts paths to include
  var scriptPaths = require('./src/piskel-script-list.js').scripts;
  var piskelScripts = prefixPaths(scriptPaths, "src/");

  // get the list of styles paths to include
  var stylePaths = require('./src/piskel-style-list.js').styles;
  var piskelStyles = prefixPaths(stylePaths, "src/");

  var getConnectConfig = function (base, port, host, open) {
    return {
      options: {
        port: port,
        hostname: host,
        base: base,
        open: open
      }
    };
  };

  // load all grunt tasks
  require('load-grunt-tasks')(grunt);

  grunt.initConfig({
    clean: {
      all: ['dest', 'src/img/icons.png', 'src/css/icons.css'],
      prod: ['dest/prod', 'dest/tmp'],
      desktop: ['dest/desktop', 'dest/tmp'],
      dev: ['dest/dev', 'dest/tmp']
    },

    /**
     * STYLE CHECKS
     */

    leadingIndent: {
      options: {
        indentation: "spaces"
      },
      css: ['src/css/**/*.css']
    },

    eslint: {
      files: [
        // Includes
        'src/js/**/*.js',
        // Exludes
        // TODO: remove this (for now we still get warnings from the lib folder)
        '!src/js/**/lib/**/*.js'
      ],
      options: {
        fix: grunt.option('fix') // this will get params from the flags
      }
    },

    /**
     * SERVERS, BROWSER LAUNCHERS
     */

    connect: {
      prod: getConnectConfig(['dest/prod', 'test'], PORT.PROD, hostname, true),
      test: getConnectConfig(['dest/prod', 'tests/e2e/data'], PORT.PROD, hostname, true),
      dev: getConnectConfig(['dest/dev', 'test'], PORT.DEV, hostname, 'http://' + hostname + ':' + PORT.DEV + '/?debug')
    },

    watch: {
      prod: {
        files: ['src/**/*.*'],
        tasks: ['build'],
        options: {
          spawn: false
        }
      },
      dev: {
        files: ['src/**/*.*'],
        tasks: ['build-dev'],
        options: {
          spawn: false
        }
      }
    },

    /**
     * BUILD STEPS
     */

    sprite: {
      all: {
        src: 'src/img/icons/**/*.png',
        retinaSrcFilter: 'src/img/icons/**/*@2x.png',
        dest: 'src/img/icons.png',
        retinaDest: 'src/img/icons@2x.png',
        destCss: 'src/css/icons.css'
      }
    },

    concat: {
      js: {
        options: {
          separator: ';'
        },
        src: piskelScripts,
        dest: 'dest/prod/js/piskel-packaged' + version + '.js'
      },
      css: {
        src: piskelStyles,
        dest: 'dest/tmp/css/piskel-style-packaged' + version + '.css'
      }
    },

    uglify: {
      options: {
        mangle: true
      },
      js: {
        files: {
          'dest/tmp/js/piskel-packaged-min.js': ['dest/prod/js/piskel-packaged' + version + '.js']
        }
      }
    },

    includereplace: {
      all: {
        src: 'src/index.html',
        dest: 'dest/tmp/index.html',
        options: {
          globals: {
            'version': version,
            'releaseVersion': releaseVersion
          }
        }
      }
    },

    replace: {
      // main-partial.html is used when embedded in the legacy piskelapp.com
      mainPartial: {
        options: {
          patterns: [{
            match: /^(.|[\r\n])*<!--body-main-start-->/,
            replacement: "{% raw %}",
            description: "Remove everything before body-main-start comment"
          }, {
            match: /<!--body-main-end-->(.|[\r\n])*$/,
            replacement: "{% endraw %}",
            description: "Remove everything after body-main-end comment"
          }, {
            match: /([\r\n])  /g,
            replacement: "$1",
            description: "Decrease indentation by one"
          }
          ]
        },
        files: [
          // src/index.html should already have been moved by the includereplace task
          { src: ['dest/tmp/index.html'], dest: 'dest/prod/piskelapp-partials/main-partial.html' }
        ]
      },

      // piskel-web-partial.html is used when embedded in piskelapp.com
      piskelWebPartial: {
        options: {
          patterns: [{
            match: /^(.|[\r\n])*<!--body-main-start-->/,
            replacement: "---\nlayout: \"editorLayout.html\"\n---\n\n",
            description: "Remove everything before body-main-start comment"
          }, {
            match: /<!--body-main-end-->(.|[\r\n])*$/,
            replacement: "",
            description: "Remove everything after body-main-end comment"
          }, {
            match: /([\r\n])  /g,
            replacement: "$1",
            description: "Decrease indentation by one"
          }
          ]
        },
        files: [
          // src/index.html should already have been moved by the includereplace task
          { src: ['dest/tmp/index.html'], dest: 'dest/prod/piskelapp-partials/piskel-web-partial.html' }
        ]
      },

      // Generate another piskel web partial for kids.
      piskelWebPartialKids: {
        options: {
          patterns: [{
            match: /^(.|[\r\n])*<!--body-main-start-->/,
            replacement: "---\nlayout: \"editorLayout.html\"\nenableSafeMode: true\n---\n\n",
            description: "Remove everything before body-main-start comment"
          }, {
            match: /<!--body-main-end-->(.|[\r\n])*$/,
            replacement: "",
            description: "Remove everything after body-main-end comment"
          }, {
            match: /([\r\n])  /g,
            replacement: "$1",
            description: "Decrease indentation by one"
          }
          ]
        },
        files: [
          // src/index.html should already have been moved by the includereplace task
          { src: ['dest/tmp/index.html'], dest: 'dest/prod/piskelapp-partials/piskel-web-partial-kids.html' }
        ]
      },

      css: {
        options: {
          patterns: [{
            match: /var\(--highlight-color\)/g,
            replacement: "gold",
          }]
        },
        files: [{
          src: ['dest/tmp/css/piskel-style-packaged' + version + '.css'],
          dest: 'dest/prod/css/piskel-style-packaged' + version + '.css'
        }]
      }
    },

    copy: {
      prod: {
        files: [
          // dest/js/piskel-packaged-min.js should have been created by the uglify task
          { src: ['dest/tmp/js/piskel-packaged-min.js'], dest: 'dest/prod/js/piskel-packaged-min' + version + '.js' },
          { src: ['dest/tmp/index.html'], dest: 'dest/prod/index.html' },
          { src: ['src/logo.png'], dest: 'dest/prod/logo.png' },
          { src: ['src/js/lib/gif/gif.ie.worker.js'], dest: 'dest/prod/js/lib/gif/gif.ie.worker.js' },
          { expand: true, src: ['img/**'], cwd: 'src/', dest: 'dest/prod/', filter: 'isFile' },
          { expand: true, src: ['css/fonts/**'], cwd: 'src/', dest: 'dest/prod/', filter: 'isFile' }
        ]
      },
      dev: {
        files: [
          // in dev copy everything to dest/dev
          { src: ['dest/tmp/index.html'], dest: 'dest/dev/index.html' },
          { src: ['src/piskel-script-list.js'], dest: 'dest/dev/piskel-script-list.js' },
          { src: ['src/piskel-style-list.js'], dest: 'dest/dev/piskel-style-list.js' },
          { expand: true, src: ['js/**'], cwd: 'src/', dest: 'dest/dev/', filter: 'isFile' },
          { expand: true, src: ['css/**'], cwd: 'src/', dest: 'dest/dev/', filter: 'isFile' },
          { expand: true, src: ['img/**'], cwd: 'src/', dest: 'dest/dev/', filter: 'isFile' },
        ]
      }
    },

    /**
     * DESKTOP BUILDS
     * Uses nw-builder 4.x API with NW.js 0.92.0
     * Targets: Windows 10+, macOS 11+ (Intel & ARM), Linux x64
     */

    nwjs: {
      // Windows 10+ (x64)
      win: {
        options: {
          mode: "build",
          version: "0.92.0",
          platform: "win",
          arch: "x64",
          outDir: "./dest/desktop/",
          flavor: "normal",
          glob: true,
          app: {
            name: "RetroPiskel",
            icon: "./misc/desktop/logo.ico",
            company: "Unveil",
            fileDescription: "Retro console sprite editor",
            productName: "RetroPiskel",
            legalCopyright: "Copyright © 2025 Unveil"
          }
        },
        src: ['./dest/prod/**/*', "./package.json"]
      },

      // Linux x64
      linux: {
        options: {
          mode: "build",
          version: "0.92.0",
          platform: "linux",
          arch: "x64",
          outDir: "./dest/desktop/",
          flavor: "normal",
          glob: true,
          app: {
            name: "RetroPiskel",
            genericName: "Sprite Editor",
            comment: "Retro console sprite editor"
          }
        },
        src: ['./dest/prod/**/*', "./package.json"]
      },

      // macOS 11+ Intel (x64)
      mac: {
        options: {
          mode: "build",
          version: "0.92.0",
          platform: "osx",
          arch: "x64",
          outDir: "./dest/desktop/",
          flavor: "normal",
          glob: true,
          app: {
            name: "RetroPiskel",
            icon: "./misc/desktop/nw.icns",
            LSApplicationCategoryType: "public.app-category.graphics-design",
            CFBundleIdentifier: "com.unveil.retropiskel",
            CFBundleName: "RetroPiskel",
            CFBundleDisplayName: "RetroPiskel",
            CFBundleSpokenName: "RetroPiskel",
            CFBundleVersion: releaseVersion,
            CFBundleShortVersionString: releaseVersion,
            NSHumanReadableCopyright: "Copyright © 2025 Unveil",
            NSLocalNetworkUsageDescription:
              "RetroPiskel does not access the local network"
          }
        },
        src: ['./dest/prod/**/*', "./package.json"]
      },

      // macOS 11+ Apple Silicon (arm64)
      macArm: {
        options: {
          mode: "build",
          version: "0.92.0",
          platform: "osx",
          arch: "arm64",
          outDir: "./dest/desktop/",
          flavor: "normal",
          glob: true,
          app: {
            name: "RetroPiskel",
            icon: "./misc/desktop/nw.icns",
            LSApplicationCategoryType: "public.app-category.graphics-design",
            CFBundleIdentifier: "com.unveil.retropiskel",
            CFBundleName: "RetroPiskel",
            CFBundleDisplayName: "RetroPiskel",
            CFBundleSpokenName: "RetroPiskel",
            CFBundleVersion: releaseVersion,
            CFBundleShortVersionString: releaseVersion,
            NSHumanReadableCopyright: "Copyright © 2025 Unveil",
            NSLocalNetworkUsageDescription:
              "RetroPiskel does not access the local network"
          }
        },
        src: ['./dest/prod/**/*', "./package.json"]
      }
    }
  });

  // TEST TASKS
  // Run linting
  grunt.registerTask('lint', ['eslint', 'leadingIndent:css']);

  // Used by optional precommit hook
  grunt.registerTask('precommit', ['test']);

  // BUILD TASKS
  grunt.registerTask('build-index.html', ['includereplace']);
  grunt.registerTask('merge-statics', ['concat:js', 'concat:css', 'uglify']);
  grunt.registerTask('build-partials', ['replace:mainPartial', 'replace:piskelWebPartial', 'replace:piskelWebPartialKids']);
  grunt.registerTask('build', ['clean:prod', 'sprite', 'merge-statics', 'build-index.html', 'build-partials', 'replace:css', 'copy:prod']);
  grunt.registerTask('build-dev', ['clean:dev', 'sprite', 'build-index.html', 'copy:dev']);
  grunt.registerTask('desktop', ['clean:desktop', 'default', 'nwjs:win', 'nwjs:linux']);
  grunt.registerTask('desktop-mac', ['clean:desktop', 'default', 'nwjs:mac']);
  grunt.registerTask('desktop-mac-arm', ['clean:desktop', 'default', 'nwjs:macArm']);
  grunt.registerTask('desktop-all', [
    'clean:desktop', 'default', 'nwjs:win', 'nwjs:linux', 'nwjs:mac', 'nwjs:macArm'
  ]);

  // SERVER TASKS
  // Start webserver and watch for changes
  grunt.registerTask('serve', ['build', 'connect:prod', 'watch:prod']);
  grunt.registerTask('serve-test', ['build', 'connect:test', 'watch:prod']);
  // Start webserver on src folder, in debug mode
  grunt.registerTask('play', ['build-dev', 'connect:dev', 'watch:dev']);

  // ALIASES, kept for backward compatibility
  grunt.registerTask('serve-debug', ['play']);
  grunt.registerTask('serve-dev', ['play']);
  grunt.registerTask('test-local', ['test']);

  // Default task
  grunt.registerTask('default', ['lint', 'build']);
};
