/***************************************************************************************************************************************************************
 *
 * Build documentation from your react layouts
 *
 **************************************************************************************************************************************************************/

'use strict';


//--------------------------------------------------------------------------------------------------------------------------------------------------------------
// Dependencies
//--------------------------------------------------------------------------------------------------------------------------------------------------------------
const ReactDocs = require('react-docgen');
import React from 'react';
import Path from 'path';
import Fs from 'fs';


//--------------------------------------------------------------------------------------------------------------------------------------------------------------
// Local
//--------------------------------------------------------------------------------------------------------------------------------------------------------------
import { ReadFile, CreateFile, CreateDir, RemoveDir, CopyFiles } from './files';
import { ParseYaml, ParseMD } from './parse';
import { SETTINGS } from './settings.js';
import { RenderReact } from './render';
import { Log, Style } from './helper';
import { GetLayout } from './site';
import { Pages } from './pages';
import { Nav } from './nav';


/**
 * The source of our ipsum lorem
 *
 * @type {string}
 */
const Ipsum = Fs.readFileSync( Path.normalize(`${ __dirname }/../assets/ipsum.txt`), 'utf8' );


/**
 * The layout files we use to render the docs
 *
 * @type {Object}
 */
const Layout = {
	index: '.template/docs/layout/index.js',
	category: '.template/docs/layout/category.js',
};

const Root = 'files/';


/**
 * Build our docs from the source folder
 */
export const BuildDocs = () => {
	Log.info(`Generating docs`);

	const components = GetLayout();
	// const components = ['all/all.js'];
	const categories = GetCategories( components );
	const allLayouts = [];
	const forNav = [];
	const forPages = [];

	categories.map( category => {
		allLayouts.push(
			GetCategoryComponents( category, components )
		);

		if( category === '.' ) {
			category = 'index';
			forNav.push('index');
			forPages.push('index');
		}
		else {
			forNav.push( category );
			forPages.push( category );
		}

		Pages.inject( category, { title: category });
	});

	Nav.set( forNav );


	return new Promise( ( resolve, reject ) => {
		Promise.all( allLayouts )
			.catch( error => reject( error ) )
			.then( pages => {
				const allPages = [];

				pages.map( page => {
					allPages.push(
						CreateCategory( page, components )
					);
				});

				allPages.push(
					CreateIndex( forPages, components )
				);

				Promise.all( allPages )
					.catch( error => reject( error ) )
					.then( () => {
						resolve( allPages.length );
					});
		});
	});
}


/**
 * Get all categories from our src/ folders
 *
 * @param  {array} components - An array of all layout components
 *
 * @return {array}            - An array of all category paths
 */
export const GetCategories = ( components ) => {
	Log.verbose(`Getting all categories`);

	const categories = [];

	components.map( component => {
		const category = Path.dirname( component );

		if( !categories.includes( category ) ) {
			categories.push( category );
		}
	});

	Log.verbose(`Categories are:\n${ Style.yellow( JSON.stringify( categories ) ) }`);

	return categories;
};


/**
 * Pick all components of a category and send them to the parser
 *
 * @param  {string} category   - The category we are in
 * @param  {array}  components - All components in a neat array
 *
 * @return {Promise object}    - The parsed components
 */
export const GetCategoryComponents = ( category, components ) => {
	Log.verbose(`Getting all components for categories ${ Style.yellow( category ) }`);

	const allComponents = [];

	if( Array.isArray( components ) ) {

		return new Promise( ( resolve, reject ) => {

			components.map( component => {
				if( Path.dirname( component ) === category ) {
					Log.verbose(`Found component ${ Style.yellow( component ) } for categories ${ Style.yellow( category ) }`);

					allComponents.push(
						ParseComponent( component )                                // Parse the component first
							.then( ( data ) => BuildPropsYaml( data, component ) )   // then we build the yaml and props
							.then( ( data ) => BuildHTML( data, component ) )        // now we shoot it all into the HTML blender
							.then( data => Object.assign( {}, { category }, data ) ) // and finally we keep category in our return value
					);
				}
			});

			Promise.all( allComponents )
				.catch( error => reject( error ) )
				.then( parsedComponents => resolve( parsedComponents ) );
		});
	}
	else {
		Promise.reject(`Components must be an array, was "${ Style.yellow( typeof components ) }"`);
	}
};


/**
 * Generate the category html and write it to disk
 *
 * @param  {array}  components          - An array of all components parsed
 * @param  {string} components.category - The category of this component
 * @param  {string} components.file     - The file name of this component
 * @param  {string} components.yaml     - The parsed yaml markup
 * @param  {string} components.html     - The parsed HTML
 *
 * @return {Promise object}             - Resolve when done
 */
export const CreateCategory = ( components ) => {
	Log.verbose(`Creating category ${ Style.yellow( components.category ) }`);

	return new Promise( ( resolve, reject ) => {
		const categoryPath = Path.normalize(`${ SETTINGS.get().folder.docs }/${ Root }/${ components[ 0 ].category }/index.html`);
		const layoutPath = Path.normalize(`${ __dirname }/../${ Layout.category }`);

		const ID = components[ 0 ].category === '.' ? `index` : components[ 0 ].category;

		const props = {
			_ID: ID,
			_title: `Category ${ components[ 0 ].category }`,
			_category: components[ 0 ].category,
			_components: components,
			_pages: Pages.get(),
			_nav: Nav.get(),
			_relativeURL: ( URL, ID ) => {
				if( ID === 'index' ) {
					ID = `.`;
				}

				return Path.relative( Path.normalize(`${ SETTINGS.get().folder.docs }/${ Root }${ ID }`), Path.normalize(`${ SETTINGS.get().folder.docs }/${ Root }/${ URL }`));
			},
		};

		const html = RenderReact( layoutPath, props );

		CreateFile( categoryPath, html )
			.catch( error => reject( error ) )
			.then( () => resolve() );
	});
};


/**
 * Generate the homepage html and write it to disk
 *
 * @param  {array}  categories - An array of all categories
 * @param  {array}  components - An array of all components
 *
 * @return {Promise object} - Resolve when done
 */
export const CreateIndex = ( categories, components ) => {
	Log.verbose(`Creating index page`);

	return new Promise( ( resolve, reject ) => {
		const categoryPath = Path.normalize(`${ SETTINGS.get().folder.docs }/index.html`);
		const layoutPath = Path.normalize(`${ __dirname }/../${ Layout.index }`);

		const props = {
			_ID: '/homepage/',
			_title: `Docs home`,
			_pages: Pages.get(),
			_nav: Nav.get(),
			_components: components,
			_categories: categories,
			_relativeURL: ( URL, ID ) => {
				if( ID === 'index' ) {
					ID = '.';
				}

				return Path.relative( SETTINGS.get().folder.docs, Path.normalize(`${ SETTINGS.get().folder.docs }/${ Root }/${ URL }`));
			},
		};

		const html = RenderReact( layoutPath, props );

		CreateFile( categoryPath, html )
			.catch( error => reject( error ) )
			.then( () => resolve() );
	})
};


/**
 * Get infos about a react component by running it through our propType parser
 *
 * @param  {string} component - The path to the layout file
 *
 * @return {Promise object}   - The object with all gathered infos, format: { file: '', infos: {} }
 */
export const ParseComponent = ( component ) => {
	Log.verbose(`Getting component infos from ${ Style.yellow( component ) }`);

	return new Promise( ( resolve, reject ) => {

		const componentPath = Path.normalize(`${ SETTINGS.get().folder.src }/${ component }`);

		ReadFile( componentPath )
			.catch( error => reject( error ) )
			.then( react => {
				try {
					resolve({
						file: component,
						infos: ReactDocs.parse( react ),
					});
				}
				catch( error ) {
					Log.error(`Trying to gather infos from the react component ${ Style.yellow( component ) } failed.`);
					Log.error( error );

					process.exit( 1 );
				}
			}
		);
	});
};


/**
 * Build our props and yaml from the description of our propTypes
 *
 * @param  {object} object          - The object with infos about this react component
 * @param  {string} object.file     - The file path and name
 * @param  {object} object.infos    - The object with parsed infos about the react component
 *
 * @return {object}                 - The object with all gathered infos, format: { file: '', contents: '', infos: {}, props: {}, yaml: '' }
 */
export const BuildPropsYaml = ( object, component ) => {
	Log.verbose(`Building props and yaml from the gathered infos for ${ Style.yellow( component ) }`);

	return new Promise( ( resolve, reject ) => {
		const flags = {
			required: `<span class="flag flag--optional">Optional</span>`,
			default: ( value ) => `<span class="flag flag--default">default: <span class="flag__value">${ value }</span></span>`,
		};
		let props = {};
		let yaml = '';

		if( object.infos.props ) {
			Object.keys( object.infos.props ).map( propKey => {
				const prop = object.infos.props[ propKey ];
				let example;

				prop.description = prop.description || '';

				example = ParseYaml( prop.description );
				props = Object.assign( {}, props, ParseExample( example ) );

				yaml += `${
					prop.required
						? ''
						: flags['required']
					}${
					prop.defaultValue
						? flags['default']( prop.defaultValue.value )
						: ''
					}${ ReplaceMagic( prop.description ) }\n`;
			});
		}

		resolve({
			file: object.file,
			infos: object.infos,
			props,
			yaml: <div dangerouslySetInnerHTML={ { __html: yaml } } />,
		})
	});
};


/**
 * Build out HTML for the component so we can show it
 *
 * @param  {object} object          - The object with infos about this react component
 * @param  {string} object.file     - The file path and name
 * @param  {object} object.infos    - The object with parsed infos about the react component
 * @param  {object} object.props    - The object with all props we need
 * @param  {string} object.yaml     - The yaml
 *
 * @return {object}                 - The object with all gathered infos, format: { file: '', yaml: '', html: '' }
 */
export const BuildHTML = ( object, component ) => {
	Log.verbose(`Building HTML for ${ Style.yellow( component ) }`);

	return new Promise( ( resolve, reject ) => {
		const componentPath = Path.normalize(`${ SETTINGS.get().folder.src }/${ object.file }`);
		const html = RenderReact( componentPath, object.props );

		resolve({
			file: object.file,
			yaml: object.yaml,
			html,
			component: <div dangerouslySetInnerHTML={ { __html: html } } />,
		})
	});
};


/**
 * Parse an example object
 *
 * @param  {object} example - The example from our props description already rendered in yaml
 *
 * @return {sting}          - The example with all magic strings replaced
 */
export const ParseExample = ( example ) => {
	Log.verbose(`Parsing example for magic inside ${ Style.yellow( example ) }`);

	const parsedExample = Object.assign( {}, example );

	vocabulary.map( command => {
		Object.keys( example ).map( key => {
			const exampleVar = example[ key ];

			if( typeof exampleVar === 'object' ) {
				// TODO
			}
			else if( typeof exampleVar === 'string' && exampleVar.includes(`(${ command.name })`) ) {
				const partials = exampleVar.split(`(${ command.name })(`);
				const amount = parseInt( partials[ 1 ].slice( 0, -1 ) );

				if( amount > 0 ) {
					parsedExample[ key ] = command.func( amount );
				}

			}
		});
	});

	return parsedExample;
};


/**
 * Replace some magic strings with something more human readable
 *
 * @param  {string} example - The string to be unmagified
 *
 * @return {string}         - More human readable string
 */
export const ReplaceMagic = ( example ) => {
	let parsedExample = example;

	vocabulary.map( command => {
		const regex = new RegExp(`(\\(${ command.name }\\))[(].*[)]`, 'g');
		parsedExample = parsedExample.replace( regex, command.replacement );
	});

	return parsedExample;
};


/**
 * Make a partial placeholder
 *
 * @param  {integer} amount - The amount of partials we want to show
 *
 * @return {string}         - The partial placeholders
 */
export const MakePartials = ( amount ) => {
	return 'image '.repeat( amount );
};


/**
 * Make some dummy text from a text file with n amount of sentences
 *
 * @param  {integer} amount - Amount of sentences
 *
 * @return {string}         - The dummy text
 */
export const MakeIpsum = ( amount ) => {
	const sentences = Ipsum.split('.');
	let output = '';

	if( amount >= sentences.length ) {
		const mulitplier = Math.floor( amount / sentences.length );
		output = `${ Ipsum }\n`.repeat( mulitplier );

		amount -= mulitplier * sentences.length;
	}

	for( let i = 0; i < amount; i++ ) {
		output += `${ sentences[ i ] }.`;
	};

	output = ParseMD( output ).replace(/(?:\r\n|\r|\n)/g, ' ');

	return <div dangerouslySetInnerHTML={ { __html: output } } />;
};


/**
 * Magic strings and how to handle them
 *
 * @type {Array}
 */
const vocabulary = [
	{
		name: 'partials',
		func: MakePartials,
		replacement: '\n  - partial1.md\n  - partial2.md\n  - partial3.md',
	},
	{
		name: 'text',
		func: MakeIpsum,
		replacement: `${ Ipsum.slice(0, 91) }...`,
	},
];
