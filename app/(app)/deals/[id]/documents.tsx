import { removeFile } from '@/app/actions';
import { DEMO_KEEP_HOURS, FILE_KINDS, MAX_FILE_BYTES, fileError, fileSize } from '@/lib/files';
import { mayAdd, mayOpen, type FileRow, type Room } from '@/lib/deal-files';
import { label } from '@/lib/labels';
import { Upload } from '@/components/upload';
import { day } from '@/components/ui';

type Props = {
  room: Room;
  viewer: { id: string; sample: boolean };
  files: FileRow[];
  /** This browser's id in the demo, if it has one. */
  browser: string | null;
  /** The outcome of an upload made without JavaScript, as a code. */
  outcome?: string;
};

/** The documents the two sides have shared in a deal room, and the form that adds one. */
export function Documents({ room, viewer, files, browser, outcome }: Props) {
  const open = room.signed || room.role === 'admin';
  const who = (f: FileRow) => (f.uploaded_by === viewer.id ? 'You' : f.uploaded_by === room.buyer_id ? 'The buyer' : 'The seller');
  return (
    <>
      <h2 id="documents">Documents</h2>
      {!open ? (
        <p className="blank">Documents open once both sides accept the NDA.</p>
      ) : (
        <>
          <p className="lede soft">
            Submittals, factory test reports, nameplate photos and the buyer&rsquo;s spec. Only the two sides of this deal and Gridstock can open them.
          </p>
          {outcome === 'added' && <div className="notice" role="status">Document added.</div>}
          {outcome && outcome !== 'added' && <div className="notice" role="alert">{fileError(outcome)}</div>}
          {files.length === 0 ? (
            <p className="blank">No documents yet.{room.stage === 'lost' ? '' : ' The seller usually starts with the submittal and the factory test report.'}</p>
          ) : (
            <div className="scroll">
              <table className="data files">
                <thead>
                  <tr><th>Document</th><th>Added by</th><th className="wide-only">Size</th><th className="wide-only">Added</th><th><span className="vh">Action</span></th></tr>
                </thead>
                <tbody>
                  {files.map(f => {
                    const kind = label(FILE_KINDS, f.kind);
                    const mine = f.uploaded_by === viewer.id && (f.visitor == null || f.visitor === browser);
                    if (!mayOpen(room, viewer.id, f, browser)) {
                      return (
                        <tr key={f.id}>
                          <td className="lead-cell">
                            {kind}
                            <div className="under">
                              {f.visitor != null && f.visitor !== browser
                                ? 'Added from another browser. In the demo, only that browser can open a file or see its name.'
                                : 'Closed to you since the deal ended.'}
                            </div>
                          </td>
                          <td>{who(f)}</td>
                          <td className="wide-only num">{fileSize(f.size)}</td>
                          <td className="wide-only num">{day(f.created_at)}</td>
                          <td />
                        </tr>
                      );
                    }
                    return (
                      <tr key={f.id}>
                        <td className="lead-cell">
                          <a className="file" href={`/deals/${room.id}/files/${f.id}`} download>{f.name}</a>
                          <div className="under">{kind}<span className="narrow-only">, {fileSize(f.size)}</span></div>
                        </td>
                        <td>{who(f)}</td>
                        <td className="wide-only num">{fileSize(f.size)}</td>
                        <td className="wide-only num">{day(f.created_at)}</td>
                        <td>
                          {mine && (
                            <form action={removeFile}>
                              <input type="hidden" name="deal_id" value={room.id} />
                              <input type="hidden" name="file_id" value={f.id} />
                              <button className="text" aria-label={`Remove ${f.name}`}>Remove</button>
                            </form>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {mayAdd(room) && <Upload dealId={room.id} />}
          {viewer.sample && mayAdd(room) && (
            <p className="soft small upload-terms">
              This is the shared demo. A file added here can be opened only from the browser that added it, other visitors do not see
              its name, and it is deleted after {DEMO_KEEP_HOURS} hours. A file can be up to {MAX_FILE_BYTES / (1024 * 1024)} MB.
            </p>
          )}
        </>
      )}
    </>
  );
}
