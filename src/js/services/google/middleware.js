import { compact } from 'lodash';
import { arrayOf, indexToArray } from '../../util/arrays';
import {
  formatAlbum,
  formatArtists,
  formatTracks,
} from '../../util/format';
import { i18n } from '../../locale';
const coreActions = require('../core/actions');
const mopidyActions = require('../mopidy/actions');
const uiActions = require('../ui/actions');

const GoogleMiddleware = (function () {
  // A Google request is an alias of the Mopidy request
  const request = (store, method, params = null, response_callback = null, error_callback = null) => {
    store.dispatch(
      mopidyActions.request(
        method,
        params,
        response_callback,
        error_callback,
      ),
    );
  };

  return (store) => (next) => (action) => {
    switch (action.type) {
      case 'GOOGLE_GET_LIBRARY_ALBUMS': {
        request(
          store,
          'library.browse',
          { uri: 'gmusic:album' },
          (browseResponse) => {
            const allUris = arrayOf('uri', browseResponse);
            const run = () => {
              if (allUris.length) {
                const uris = allUris.splice(0, 5);
                request(
                  store,
                  'library.lookup',
                  { uris },
                  (lookupResponse) => {
                    const libraryAlbums = compact(indexToArray(lookupResponse).map((tracks) => {
                      if (tracks.length) {
                        return {
                          artists: tracks[0].artists ? formatArtists(tracks[0].artists) : null,
                          tracks: formatTracks(tracks),
                          last_modified: tracks[0].last_modified,
                          ...formatAlbum(tracks[0].album),
                        };
                      }
                    }));

                    if (libraryAlbums.length) {
                      store.dispatch(coreActions.itemsLoaded(libraryAlbums));
                    }
                    run();
                  },
                );
              } else {
                store.dispatch(coreActions.libraryLoaded({
                  uri: 'google:library:albums',
                  items_uris: arrayOf('uri', allUris),
                }));
              }
            };

            run();
          },
        );
        break;
      }

      case 'GOOGLE_GET_LIBRARY_ARTISTS': {
        store.dispatch(uiActions.updateProcess(
          'GOOGLE_GET_LIBRARY_ARTISTS',
          i18n(
            'common.loading_library',
            {
              provider: i18n('services.google.title'),
              type: i18n('artist.title'),
            },
          ),
        ));

        request(
          store,
          'library.browse',
          { uri: 'gmusic:artist' },
          (browseResponse) => {
            store.dispatch(uiActions.updateProcess(
              'GOOGLE_GET_LIBRARY_ARTISTS',
              i18n(
                'common.loading_library',
                {
                  provider: i18n('services.google.title'),
                  type: i18n('artist.title'),
                },
              ),
              {
                remaining: browseResponse.length,
                total: browseResponse.length,
              },
            ));

            const allUris = arrayOf('uri', browseResponse);
            const run = () => {
              const uris = allUris.splice(0, 5);
              const processor = store.getState().ui.processes.GOOGLE_GET_LIBRARY_ARTISTS;
  
              if (processor && processor.status === 'cancelling') {
                store.dispatch(uiActions.processCancelled('GOOGLE_GET_LIBRARY_ARTISTS'));
                return;
              }
              store.dispatch(uiActions.updateProcess(
                'GOOGLE_GET_LIBRARY_ARTISTS',
                i18n(
                  'common.loading_library',
                  {
                    provider: i18n('services.google.title'),
                    type: i18n('artist.title'),
                  },
                ),
                {
                  remaining: allUris.length,
                },
              ));

              if (uris.length) {
                request(
                  store,
                  'library.lookup',
                  { uris },
                  (lookupResponse) => {
                    const libraryArtists = compact(indexToArray(lookupResponse).map((tracks) => {
                      if (tracks.length) {
                        return {
                          artists: tracks[0].artists ? formatArtists(tracks[0].artists) : null,
                          tracks: formatTracks(tracks),
                          last_modified: tracks[0].last_modified,
                          ...formatAlbum(tracks[0].album),
                        };
                      }
                    }));

                    if (libraryArtists.length) {
                      store.dispatch(coreActions.itemsLoaded(libraryArtists));
                    }
                    run();
                  },
                );
              } else {
                store.dispatch(uiActions.processFinished('GOOGLE_GET_LIBRARY_ARTISTS'));
                store.dispatch(coreActions.libraryLoaded({
                  uri: 'google:library:artists',
                  items_uris: arrayOf('uri', allUris),
                }));
              }
            };

            run();
          },
        );
        break;
      }

      default:
        return next(action);
    }
  };
}());

export default GoogleMiddleware;
