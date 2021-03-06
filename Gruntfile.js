// jscs:disable maximumLineLength

'use strict';

var fs = require('fs');
var path = require('path');

module.exports = function (grunt) {

    // autoload installed tasks
    [
        'grunt-atomizer',
        'grunt-babel',
        'grunt-contrib-clean',
        'grunt-contrib-connect',
        'grunt-contrib-jshint',
        'grunt-contrib-watch',
        'grunt-shell',
        'grunt-webpack'
    ].forEach(function (packageName) {
        var moduleTasks = path.resolve(__dirname, '..', 'node_modules', packageName, 'tasks');

        if (!fs.existsSync(moduleTasks)) {
            moduleTasks = path.resolve(process.cwd(), 'node_modules', packageName, 'tasks');
        }

        if (fs.existsSync(moduleTasks)) {
            grunt.loadTasks(moduleTasks);
        } else {
            grunt.log.error(moduleTasks + ' could not be found.');
        }
    });

    // configurable paths
    var env = process.env;
    var projectConfig = {
        src: 'src',
        dist: 'dist',
        unit: 'tests/unit',
        functional: 'tests/functional',
        spec: 'tests/spec',
        coverage_dir: grunt.option('coverage_dir') || 'artifacts',
        test_results_dir: grunt.option('test_results_dir') || 'artifacts'
    };

    env.XUNIT_FILE = projectConfig.test_results_dir + '/xunit.xml';

    grunt.initConfig({
        project: projectConfig,
        clean: {
            dist: {
                files: [
                    {
                        dot: true,
                        src: ['<%= project.dist %>']
                    }
                ]
            },
            functional: {
                files: [
                    {
                        dot: true,
                        src: [
                            '<%= project.functional %>/main.js',
                            '<%= project.functional %>/css/atomic.css',
                            '<%= project.functional %>/console.js',
                            '<%= project.functional %>/*-functional.js'
                        ]
                    }
                ]
            }
        },
        // atomizer
        atomizer: {
            // used by functional tests
            functional: {
                files: [{
                    src: ['<%= project.src %>/*.jsx', 'tests/**/*.jsx'],
                    dest: 'tests/functional/css/atomic.css'
                }]
            }
        },
        // compiles jsx to js
        babel: {
            options: {
                plugins: ['transform-react-jsx'],
                presets: ['es2015', 'react']
            },
            dist: {
                files: [
                    {
                        expand: true,
                        cwd: '<%= project.src %>',
                        src: ['**/*.*'],
                        dest: '<%= project.dist %>/',
                        extDot: 'last',
                        ext: '.js'
                    }
                ]
            },
            functional: {
                files: [
                    {
                        expand: true,
                        src: ['<%= project.functional %>/**/*.jsx'],
                        extDot: 'last',
                        ext: '.js'
                    }
                ]
            }
        },
        // shell
        // shell commands to run protractor and istanbul
        shell: {
            cover: {
                options: {
                    execOptions: {
                        env: env
                    }
                },
                command: 'NODE_ENV=test nyc --report-dir <%= project.coverage_dir %> --reporter lcov _mocha <%= project.unit %> --compilers js:babel-register --require babel-polyfill --recursive --reporter spec --timeout 10000'
            },
            unit: {
                command: 'NODE_ENV=test nyc --reporter text --reporter text-summary _mocha <%= project.unit %> --compilers js:babel-register --require babel-polyfill --recursive --reporter spec  --timeout 10000'
            }
        },
        // webpack
        // create js rollup with webpack module loader for functional tests
        webpack: {
            functional: {
                entry: {
                    main: './<%= project.functional %>/bootstrap.js'
                },
                output: {
                    path: './<%= project.functional %>/'
                },
                module: {
                    rules: [
                        { test: /\.css$/, loader: 'style!css' },
                        { test: /\.jsx$/, loader: 'jsx-loader' },
                        { test: /\.json$/, loader: 'json-loader'}
                    ]
                }
            }
        },
        // connect
        // setup server for functional tests
        connect: {
            functional: {
                options: {
                    port: 9999,
                    base: ['<%= project.functional %>', '.']
                }
            },
       functionalOpen: {
                options: {
                    port: 9999,
                    base: ['<%= project.functional %>', '.'],
                    open: {
                        target: 'http://127.0.0.1:9999/tests/functional/page.html'
                    }
                }
            }
        },
        watch: {
            functional: {
                files: [
                    '<%= project.src%>/*.jsx',
                    '<%= project.functional%>/*.jsx',
                    '<%= project.functional%>/*.html'
                ],
                tasks: ['dist', 'functional-debug']
            }
        },
        'saucelabs-mocha': {
            all: {
                options: {
                    testname: 'react-i13n func test',
                    urls: [
                        'http://127.0.0.1:9999/tests/functional/page.html'
                    ],

                    build: process.env.TRAVIS_BUILD_NUMBER,
                    sauceConfig: {
                        'record-video': true,
                        'capture-html': false,
                        'record-screenshots': false
                    },
                    throttled: 3,
                    browsers: [
                        {
                            browserName: 'internet explorer',
                            platform: 'Windows 7',
                            version: '9'
                        },
                        {
                            browserName: 'internet explorer',
                            platform: 'Windows 8',
                            version: '10'
                        },
                        {
                            browserName: 'internet explorer',
                            platform: 'Windows 8.1',
                            version: '11'
                        },
                        {
                            browserName: 'chrome',
                            platform: 'Windows 10',
                            version: '49'
                        },
                        {
                            browserName: 'firefox',
                            platform: 'Windows 7',
                            version: '50'
                        },
                        {
                            browserName: 'safari',
                            platform: 'OS X 10.11',
                            version: '10.0'
                        }
                    ]
                }
            }
        }
    });

    grunt.loadNpmTasks('grunt-saucelabs');

    // register custom tasks

    // functional
    // 2. run atomizer functional
    // 3. compile jsx to js in tests/functional/
    // 4. copy files to tests/functional/
    // 5. use webpack to create a js bundle to tests/functional/
    // 6. get local ip address and available port then store in grunt config
    // 7. set up local server to run functional tests
    // 9. run protractor
    grunt.registerTask('functional', [
        'atomizer:functional',
        'babel:functional',
        'webpack:functional',
        'connect:functional',
        'saucelabs-mocha',
        'clean:functional'
    ]);

    // similar to functional, but don't run protractor, just open the test page
    grunt.registerTask('functional-debug', [
        'clean:dist',
        'babel:dist',
        'atomizer:functional',
        'babel:functional',
        'webpack:functional',
        'connect:functionalOpen',
        'watch:functional'
    ]);

    grunt.registerTask('cover', [
        'clean:dist',
        'babel:dist',
        'shell:cover',
    ]);

    grunt.registerTask('unit', [
        'clean:dist',
        'babel:dist',
        'shell:unit'
    ]);

    // dist
    // 1. clean dist/
    // 2. compile jsx to js in dist/
    grunt.registerTask('dist', ['clean:dist', 'babel:dist']);
    grunt.registerTask('test', ['clean:dist', 'babel:dist', 'babel:unit']);

    // default
    grunt.registerTask('default', ['dist']);
};
