// @card group="Feedback" height=64
import { C, mount } from "./_mount.js";

mount(<C.QuickActions items={[{icon:'arxiv',label:'Import arXiv',tone:'rose'},{icon:'notebook',label:'New notebook',tone:'sky'},{icon:'sticky',label:'New sticky',tone:'amber'},{icon:'canvas',label:'Open canvas',tone:'lilac'}]} />);
